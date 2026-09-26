import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { testAccountId } from "@tests/api/support/test-identity-id"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(4)
})

afterAll(async () => {
  await pool.dispose()
})

const jwtSecret = "personal-data-erasure-route-test-secret"
const templateCode = "personal_data_erasure"
const officer = 2
const approver = 4
const member = 3
const subject = 5

async function fixture() {
  const local = await pool.next()
  const { db } = await createLocalD1Context({ database: async () => local } as never, "erasure", {
    withCompanyOrganization: true,
  })
  await db.batch([
    db.prepare(
      `INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
       VALUES ('d0e5044b-a755-4028-8eda-79d08653462a', 'test:privacy-officer', 'custom', 'Privacy officer', 0, 0)`,
    ),
    db.prepare(
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('d0e5044b-a755-4028-8eda-79d08653462a', 'personal_data:erase')",
    ),
    db
      .prepare(
        "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES ('085ed3fb-b610-4ab9-8c00-8e5966aa81b3', ?1, 'd0e5044b-a755-4028-8eda-79d08653462a', 0)",
      )
      .bind(testAccountId(officer)),
  ])
  const now = Date.now()
  for (const id of ["01900054-0000-7000-8000-00000000000a", "01900054-0000-7000-8000-00000000000b"])
    await db
      .prepare(
        `INSERT INTO system_attachments
         (id, owner_account_id, object_key, status, content_type, byte_size, file_name,
          plaintext_sha256, wrapped_dek, wrapped_dek_iv, content_iv, kek_version, created_at, linked_at)
         VALUES (?1, ?2, ?3, 'linked', 'application/pdf', 10, 'file.pdf', ?4, 'wrapped', 'wrapped-iv',
          'content-iv', 1, ?5, ?5)`,
      )
      .bind(id, testAccountId(subject), `att/${id}`, "a".repeat(64), now)
      .run()
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: {
      version: 1,
      steps: [
        {
          key: "privacy_review",
          name: "Privacy review",
          approvers: [{ type: "employee", employee_code: "E004" }],
          approval_mode: "any",
          condition_mode: "all",
          conditions: [],
          due_days: null,
          escalation_approvers: [],
          rejection_behavior: "reject",
          allow_delegation: false,
        },
      ],
    },
  })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinitionEntity.create({
    key: templateCode,
    revision: 1,
    title: "Personal data erasure",
    category: "privacy",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: "system.attachment.erase",
    createdByAccountId: zAccountId.parse(testAccountId(1)),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  })
  if (definition instanceof Error) throw definition
  const published = await openSystemProcedures({ env: { DB: db } }).publish(definition, 0)
  if (published !== true) throw published

  const request = async (employee: number, path: string, method = "GET", body?: unknown) =>
    requestWithContext({
      db,
      jwtSecret,
      path,
      method,
      body,
      now: new Date().toISOString(),
      token: await createTestToken(jwtSecret, {
        employeeId: toWorkforceEmployeeId(employee),
        accountId: employee,
      }),
    })
  const attachments = async () =>
    (
      await db
        .prepare(
          "SELECT id, status, wrapped_dek FROM system_attachments WHERE id IN ('01900054-0000-7000-8000-00000000000a', '01900054-0000-7000-8000-00000000000b') ORDER BY id",
        )
        .all<{ id: string; status: string; wrapped_dek: string | null }>()
    ).results
  const audits = async () =>
    (
      await db
        .prepare(
          `SELECT action FROM system_audit_events WHERE target_type = 'system:attachment-erasure' ORDER BY rowid`,
        )
        .all<{ action: string }>()
    ).results.map((row) => row.action)
  return { db, request, attachments, audits }
}

function submission(target: unknown) {
  return {
    request_id: crypto.randomUUID(),
    template_code: templateCode,
    reason: "本人からの消去請求",
    target,
  }
}

test("従業員単位の消去申請を承認後にだけ実行し、権限の無い人と重複申請を拒否する", async () => {
  const c = await fixture()
  const target = { kind: "employee", employee_code: "E005" }

  expect(
    (await c.request(member, "/company/personal-data-erasure-requests", "POST", submission(target)))
      .status,
  ).toBe(403)

  const submitted = await c.request(
    officer,
    "/company/personal-data-erasure-requests",
    "POST",
    submission(target),
  )
  expect(submitted.status).toBe(201)
  const { application_id: applicationId } = z
    .object({ application_id: z.number() })
    .parse(await submitted.json())
  expect(
    (
      await c.request(
        officer,
        "/company/personal-data-erasure-requests",
        "POST",
        submission({ kind: "attachment", attachment_id: "01900054-0000-7000-8000-00000000000a" }),
      )
    ).status,
  ).toBe(409)

  const execute = `/company/personal-data-erasure-requests/${applicationId}/execute`
  expect((await c.request(officer, execute, "POST")).status).toBe(409)
  expect((await c.attachments()).every((row) => row.wrapped_dek !== null)).toBe(true)

  const detail = await c.request(approver, `/company/application-requests/${applicationId}`)
  expect(detail.status).toBe(200)
  const { decision_target: decisionTarget } = z
    .object({ decision_target: z.unknown() })
    .parse(await detail.json())
  const approved = await c.request(
    approver,
    `/company/application-requests/${applicationId}/approve`,
    "POST",
    { decision_target: decisionTarget, comment: null },
  )
  expect(approved.status).toBe(200)
  // 最終承認者は消去権限を持たないため、承認済みのまま鍵を残す。
  expect((await c.attachments()).every((row) => row.wrapped_dek !== null)).toBe(true)

  expect((await c.request(member, execute, "POST")).status).toBe(403)
  const destroyed = await c.request(officer, execute, "POST")
  expect(destroyed.status).toBe(200)
  expect(await destroyed.json()).toEqual({
    status: "destroyed",
    attachment_ids: [
      "01900054-0000-7000-8000-00000000000a",
      "01900054-0000-7000-8000-00000000000b",
    ],
  })
  expect(await c.attachments()).toEqual([
    { id: "01900054-0000-7000-8000-00000000000a", status: "erased", wrapped_dek: null },
    { id: "01900054-0000-7000-8000-00000000000b", status: "erased", wrapped_dek: null },
  ])
  expect(await (await c.request(officer, execute, "POST")).json()).toMatchObject({
    status: "replayed",
  })
  expect(await c.audits()).toEqual([
    "system.attachment.erasure.requested",
    "system.attachment.erasure.decided",
    "system.attachment.key.destroyed",
  ])

  expect(
    (
      await c.request(
        officer,
        "/company/personal-data-erasure-requests",
        "POST",
        submission({ kind: "attachment", attachment_id: "01900054-0000-7000-8000-00000000000a" }),
      )
    ).status,
  ).toBe(409)
})

test("消去申請テンプレートは消去権限を持つ人だけが作れる", async () => {
  const c = await fixture()
  const body = {
    code: "erasure_template",
    name: "Erasure",
    category: "privacy",
    schema_json: { fields: [] },
    completion_operation_key: "system.attachment.erase",
  }
  expect((await c.request(1, "/company/application-templates", "POST", body)).status).toBe(201)
})

test("最終承認者が消去権限を持つ場合は、承認の確定で鍵を破棄する", async () => {
  const c = await fixture()
  await c.db
    .prepare(
      "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES ('63173b26-de09-4fd6-875c-03bcaea22fd4', ?1, 'd0e5044b-a755-4028-8eda-79d08653462a', 0)",
    )
    .bind(testAccountId(approver))
    .run()
  const submitted = await c.request(
    officer,
    "/company/personal-data-erasure-requests",
    "POST",
    submission({ kind: "attachment", attachment_id: "01900054-0000-7000-8000-00000000000b" }),
  )
  expect(submitted.status).toBe(201)
  const { application_id: applicationId } = z
    .object({ application_id: z.number() })
    .parse(await submitted.json())
  const detail = await c.request(approver, `/company/application-requests/${applicationId}`)
  const { decision_target: decisionTarget } = z
    .object({ decision_target: z.unknown() })
    .parse(await detail.json())
  const approved = await c.request(
    approver,
    `/company/application-requests/${applicationId}/approve`,
    "POST",
    { decision_target: decisionTarget, comment: null },
  )
  expect(approved.status).toBe(200)
  expect(await c.attachments()).toEqual([
    { id: "01900054-0000-7000-8000-00000000000a", status: "linked", wrapped_dek: "wrapped" },
    { id: "01900054-0000-7000-8000-00000000000b", status: "erased", wrapped_dek: null },
  ])
  expect(await c.audits()).toEqual([
    "system.attachment.erasure.requested",
    "system.attachment.erasure.decided",
    "system.attachment.key.destroyed",
  ])
})
