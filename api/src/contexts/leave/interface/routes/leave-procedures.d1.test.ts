import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { createLeaveProcedureLocalD1Context } from "@/contexts/leave/test/leave-procedure-local-d1.test-support"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import { execSql } from "@tests/d1/support/exec-sql"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["publish-requirements", "legacy-selector-role", "template-permission"],
  })
})

afterAll(async () => {
  await local.dispose()
})

/** 実認証と所有権限を使って規程を設定する。 */
async function fixture(name: string) {
  const c = await createLeaveProcedureLocalD1Context(local, name)
  const secret = "leave-procedure-publish-http-test-secret"
  await execSql(
    c.database,
    `INSERT INTO system_iam_roles
    (id, key, kind, name, created_at, updated_at) VALUES ('leave-publisher', 'test:leave-publisher', 'custom', 'Leave publisher', 0, 0);
    INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('leave-publisher', 'leave:procedure:manage');`,
  )
  await c.database
    .prepare(
      "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES ('leave-publisher-binding', ?1, 'leave-publisher', 0)",
    )
    .bind(c.creator.accountId)
    .run()
  const token = await new SystemAccessTokenIssuer(secret).issue({
    accountId: c.creator.accountId,
    tokenVersion: 0,
    now: c.at,
  })
  if (token instanceof Error) throw token
  const request = (
    method: string,
    body?: unknown,
    disabled = false,
    path = "/leave/leave-procedures",
  ) =>
    requestWithContext({
      db: c.database,
      jwtSecret: secret,
      path,
      method,
      body,
      token,
      now: c.at.toISOString(),
      enabledOptInApps: disabled ? "" : "all",
      disabledDefaultApps: disabled ? "leave" : undefined,
    })
  return { ...c, request }
}

test("休暇規程の公開は明示した会社資格・版・権限を要求する", async () => {
  const c = await fixture("publish-requirements")
  const body = { expected_revision: 1, workflow: { version: 1, steps: [c.step] } }
  expect((await c.request("GET")).status).toBe(200)
  const saved = await c.request("PUT", body)
  expect(saved.status).toBe(200)
  expect(await saved.json()).toMatchObject({ revision: 2 })
  expect((await c.request("PUT", body)).status).toBe(409)
  expect(await (await c.request("GET")).json()).toMatchObject({ revision: 2 })
  await c.database
    .prepare("UPDATE system_role_bindings SET revoked_at = ?1 WHERE id = 'leave-publisher-binding'")
    .bind(c.at.getTime())
    .run()
  expect((await c.request("GET")).status).toBe(403)
  expect((await c.request("PUT", { ...body, expected_revision: 2 })).status).toBe(403)
})

test("休暇規程は旧責務selector・技術roleへの新規依存を許さない", async () => {
  const c = await fixture("legacy-selector-role")
  for (const selector of [
    { type: "role", role_key: "admin" },
    { type: "responsibility", responsibility_type: "PEOPLE_OPERATIONS" },
  ]) {
    const step = { ...c.step, governance_authority: undefined, approvers: [selector] }
    const response = await c.request("PUT", {
      expected_revision: 1,
      workflow: { version: 1, steps: [step] },
    })
    expect(response.status).toBe(400)
  }
  expect(await (await c.request("GET")).json()).toMatchObject({ revision: 1 })
  expect(
    (
      await c.request(
        "PUT",
        { expected_revision: 1, workflow: { version: 1, steps: [c.step] } },
        true,
      )
    ).status,
  ).toBe(404)
})

test("汎用テンプレートの管理権限から休暇規程を変更できない", async () => {
  const c = await fixture("template-permission")
  await execSql(
    c.database,
    "DELETE FROM system_iam_role_permissions WHERE role_id = 'leave-publisher'; INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('leave-publisher', 'application_template:manage')",
  )
  for (const [path, body] of [
    [
      "/company/application-templates/leave_request",
      {
        name: "Changed",
        category: "leave",
        description: null,
        schema_json: { fields: [] },
        approver_roles: [],
      },
    ],
    [
      "/company/application-templates/leave_request/workflow",
      { version: 1, expected_revision: 1, steps: [c.step] },
    ],
  ] as const) {
    expect((await c.request("PUT", body, false, path)).status).toBe(403)
  }
  expect(
    await c.database
      .prepare(
        "SELECT current_revision AS revision FROM system_procedure_definitions WHERE key = 'leave_request'",
      )
      .first<number>("revision"),
  ).toBe(1)
})
