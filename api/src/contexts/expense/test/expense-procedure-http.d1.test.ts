import { ReleaseRecordSourceFreeze } from "@system/application/records/release-record-source-freeze"
import { CreateRecordSourceFreeze } from "@system/application/records/create-record-source-freeze"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { createExpenseProcedureTestContext } from "@/contexts/expense/test/expense-procedure.test-support"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { zExpenseProcedureView } from "@/contexts/expense/interface/http/response-schemas"
import { z } from "zod"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"
import { execSql } from "@tests/d1/support/exec-sql"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(12)
})

afterAll(async () => {
  await pool.dispose()
})

async function fixture(rejectionBehavior: "reject" | "return" = "reject") {
  const c = await createExpenseProcedureTestContext(await pool.next(), rejectionBehavior)
  for (const person of [c.first, c.second]) {
    const employment = await c.database
      .prepare("SELECT id FROM company_employments WHERE employee_id = ?1")
      .bind(person.employeeId)
      .first<{ id: string }>()
    if (employment === null) throw new Error("employment missing")
    const assigned = await c.write(
      [
        {
          ...c.assignment,
          id: `assignment:http:${person.employeeId}`,
          effectiveFrom: c.at.toISOString().slice(0, 10),
          attributes: {
            ...c.assignment.attributes,
            employeeId: person.employeeId,
            employmentId: employment.id,
          },
        },
      ],
      await c.companyRevision(),
      crypto.randomUUID(),
    )
    expect(Number(assigned.status)).toBe(201)
  }
  const secret = "expense-procedure-http-test-secret"
  const request = async (
    person: typeof c.first,
    path: string,
    method = "GET",
    body?: unknown,
    enabledOptInApps = "all",
  ) => {
    const token = await new SystemAccessTokenIssuer(secret).issue({
      accountId: person.accountId,
      tokenVersion: 0,
      now: c.at,
    })
    if (token instanceof Error) throw token
    return requestWithContext({
      db: c.database,
      jwtSecret: secret,
      path,
      method,
      body,
      token,
      now: c.at.toISOString(),
      enabledOptInApps,
      disabledDefaultApps: enabledOptInApps === "" ? "expenses" : undefined,
    })
  }
  const body = {
    request_key: crypto.randomUUID(),
    category: "supplies",
    spent_at: c.at.toISOString().slice(0, 10),
    attachment_ids: [],
    amount: 500,
    note: "Replace equipment",
  }
  const created = await request(c.requester, "/expense/expenses", "POST", body)
  const json = await created.json()
  if (created.status !== 201) throw new Error("submission failed: " + (await created.text()))
  expect(created.status).toBe(201)
  const id = z.object({ id: z.uuid() }).parse(json).id
  const path = `/expense/expenses/${id}`
  return { ...c, request, body, id, path }
}

test("実認証APIから提出・受信箱・二名判断・確定・再送を通す", async () => {
  const c = await fixture()
  const replay = await c.request(c.requester, "/expense/expenses", "POST", c.body)
  expect(replay.status).toBe(200)
  const detail = await c.request(c.first, c.path)
  expect(detail.status).toBe(200)
  const view = zExpenseProcedureView.parse(await detail.json())
  expect(view.can_decide).toBe(true)
  expect(view.required_approvals).toBe(2)
  const before = await c.request(c.second, "/expense/expenses/inbox")
  expect(before.status).toBe(200)
  expect(
    z
      .object({ data: z.array(zExpenseProcedureView) })
      .parse(await before.json())
      .data.map((row) => row.id),
  ).toContain(c.id)
  expect((await c.request(c.first, c.path + "/approve", "POST", { comment: null })).status).toBe(
    400,
  )
  const decision = { decision_target: view.decision_target, comment: "Reviewed" }
  const first = await c.request(c.first, c.path + "/approve", "POST", decision)
  expect(first.status).toBe(200)
  expect(await first.json()).toMatchObject({ status: "pending" })
  const second = await c.request(c.second, c.path + "/approve", "POST", decision)
  expect(second.status).toBe(200)
  expect(await second.json()).toMatchObject({ status: "approved" })
  expect((await c.request(c.second, c.path + "/approve", "POST", decision)).status).toBe(200)
  expect(
    zExpenseProcedureView.parse(await (await c.request(c.requester, c.path)).json()).status,
  ).toBe("approved")
})

test("汎用案件の参照・判断・修復と無効Appから経費を迂回しない", async () => {
  const c = await fixture()
  const view = zExpenseProcedureView.parse(await (await c.request(c.first, c.path)).json())
  const number = view.application_id
  expect((await c.request(c.requester, `/company/application-requests/${number}`)).status).toBe(404)
  expect((await c.request(c.requester, c.path, "GET", undefined, "")).status).toBe(404)
  expect(
    (
      await c.request(
        c.requester,
        c.path + "/approve",
        "POST",
        { decision_target: view.decision_target, comment: null },
        "",
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await c.request(c.requester, c.path + "/approve", "POST", {
        decision_target: view.decision_target,
        comment: null,
      })
    ).status,
  ).toBe(403)
})

test("取消と一覧の状態が一致し、失効した権限で再送できない", async () => {
  const c = await fixture()
  const view = zExpenseProcedureView.parse(await (await c.request(c.requester, c.path)).json())
  const cancelled = await c.request(c.requester, c.path + "/cancel", "POST", {
    decision_target: view.decision_target,
  })
  expect(cancelled.status).toBe(200)
  const mine = await c.request(c.requester, "/expense/expenses/me?status=cancelled")
  expect(mine.status).toBe(200)
  expect(
    z.object({ data: z.array(zExpenseProcedureView), total: z.number() }).parse(await mine.json()),
  ).toMatchObject({ data: [{ id: c.id, status: "cancelled" }], total: 1 })
  await execSql(
    c.database,
    "DELETE FROM system_iam_role_permissions WHERE role_id = 'bdf8c152-9f77-4cf5-85cf-a3495ca3645d'",
  )
  expect(
    (
      await c.request(c.requester, c.path + "/cancel", "POST", {
        decision_target: view.decision_target,
      })
    ).status,
  ).toBe(403)
})

test("差戻し後は元の記録を残して修正版を一度だけ提出する", async () => {
  const c = await fixture("return")
  const body = { ...c.body, request_key: crypto.randomUUID(), note: "Review this request" }
  const created = await c.request(c.requester, "/expense/expenses", "POST", body)
  if (created.status !== 201) throw new Error("submission failed: " + (await created.text()))
  expect(created.status).toBe(201)
  const id = z.object({ id: z.uuid() }).parse(await created.json()).id
  const path = `/expense/expenses/${id}`
  const view = zExpenseProcedureView.parse(await (await c.request(c.first, path)).json())
  const returned = await c.request(c.first, path + "/reject", "POST", {
    decision_target: view.decision_target,
    comment: "Revise the reason",
  })
  expect(returned.status).toBe(200)
  expect(await returned.json()).toMatchObject({ status: "returned" })
  expect(
    zExpenseProcedureView.parse(await (await c.request(c.requester, path)).json()).can_resubmit,
  ).toBe(true)
  const revision = {
    ...body,
    request_key: crypto.randomUUID(),
    previous_expense_id: id,
    note: "Revised reason",
  }
  const otherOwner = await c.request(c.second, "/expense/expenses", "POST", revision)
  expect(otherOwner.status).toBe(409)
  const revised = await c.request(c.requester, "/expense/expenses", "POST", revision)
  expect(revised.status).toBe(201)
  const newId = z.object({ id: z.uuid() }).parse(await revised.json()).id
  expect(newId).not.toBe(id)
  expect((await c.request(c.requester, "/expense/expenses", "POST", revision)).status).toBe(200)
  expect(
    (
      await c.request(c.requester, "/expense/expenses", "POST", {
        ...revision,
        request_key: crypto.randomUUID(),
      })
    ).status,
  ).toBe(409)
  const original = zExpenseProcedureView.parse(await (await c.request(c.requester, path)).json())
  expect(original).toMatchObject({
    status: "returned",
    note: body.note,
    next_expense_id: newId,
    can_resubmit: false,
  })
  expect(
    await c.database.prepare("SELECT count(*) AS total FROM expenses").first<number>("total"),
  ).toBe(3)
})

test("通知保存に失敗した決裁は確定待ちとして残り、受信箱から再試行できる", async () => {
  const c = await fixture()
  const view = zExpenseProcedureView.parse(await (await c.request(c.first, c.path)).json())
  const decision = { decision_target: view.decision_target, comment: "Reviewed" }
  expect((await c.request(c.first, c.path + "/approve", "POST", decision)).status).toBe(200)
  await execSql(
    c.database,
    "CREATE TRIGGER fail_expense_completion_notification BEFORE INSERT ON system_notification_messages WHEN NEW.title = '経費が決裁されました' BEGIN SELECT RAISE(ABORT, 'notification unavailable'); END",
  )
  const failed = await c.request(c.second, c.path + "/approve", "POST", decision)
  expect(failed.status).toBe(409)
  const pending = zExpenseProcedureView.parse(await (await c.request(c.second, c.path)).json())
  expect(pending).toMatchObject({
    status: "awaiting_execution",
    can_execute: true,
    can_decide: false,
  })
  const inbox = z
    .object({ data: z.array(zExpenseProcedureView) })
    .parse(await (await c.request(c.second, "/expense/expenses/inbox")).json())
  expect(inbox.data.find((entry) => entry.id === c.id)?.can_execute).toBe(true)
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM system_execution_authorizations")
      .first<number>("total"),
  ).toBe(0)
  await execSql(c.database, "DROP TRIGGER fail_expense_completion_notification")
  expect(
    (
      await c.request(c.second, c.path + "/execute", "POST", {
        decision_target: pending.decision_target,
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await c.request(c.second, c.path + "/execute", "POST", {
        decision_target: pending.decision_target,
      })
    ).status,
  ).toBe(200)
  expect(
    await c.database
      .prepare(
        "SELECT count(*) AS total FROM system_notification_messages WHERE title = '経費が決裁されました'",
      )
      .first<number>("total"),
  ).toBe(1)
})

test("機械Principalと規程の別編集入口は人の判断・App規程を変更できない", async () => {
  const c = await fixture()
  const view = zExpenseProcedureView.parse(await (await c.request(c.first, c.path)).json())
  await c.database
    .prepare(
      "UPDATE system_principals SET kind = 'service', revision = revision + 1 WHERE account_id = ?1",
    )
    .bind(c.first.accountId)
    .run()
  expect(
    (
      await c.request(c.first, c.path + "/approve", "POST", {
        decision_target: view.decision_target,
        comment: null,
      })
    ).status,
  ).toBe(401)
  await execSql(
    c.database,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('bdf8c152-9f77-4cf5-85cf-a3495ca3645d', 'application_template:manage')",
  )
  const workflow = await c.request(
    c.requester,
    "/company/application-templates/expense_request/workflow",
    "PUT",
    { expected_revision: 1, version: 1, steps: [c.step] },
  )
  expect(workflow.status).toBe(403)
  expect(
    await c.database
      .prepare(
        "SELECT current_revision FROM system_procedure_definitions WHERE key = 'expense_request'",
      )
      .first<number>("current_revision"),
  ).toBe(1)
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM system_human_attestations")
      .first<number>("total"),
  ).toBe(0)
})

test("旧経費への承認・直接編集・削除を閉じ、本人確認後に履歴を保って接続する", async () => {
  const c = await fixture()
  const original = await c.database
    .prepare(
      "INSERT INTO expenses(id,employee_id,organization_unit_id,category,amount,spent_at,note,status,created_at) VALUES (?5,?1,?2,'supplies',500,?3,'Legacy receipt','pending',?4) RETURNING id",
    )
    .bind(
      c.requester.employeeId,
      c.assignment.attributes.organizationUnitId,
      c.body.spent_at,
      c.at.toISOString(),
      crypto.randomUUID(),
    )
    .first<{ id: string }>()
  if (original === null) throw new Error("legacy expense missing")
  const path = `/expense/expenses/${original.id}`
  const legacy = zExpenseProcedureView.parse(await (await c.request(c.requester, path)).json())
  expect(legacy).toMatchObject({
    procedure_required: true,
    can_decide: false,
    can_submit_legacy: true,
    decision_target: null,
  })
  expect((await c.request(c.first, path)).status).toBe(403)
  expect((await c.request(c.requester, path, "PUT", { ...c.body, amount: 999 })).status).toBe(404)
  expect((await c.request(c.requester, path, "DELETE")).status).toBe(404)
  const current = zExpenseProcedureView.parse(await (await c.request(c.first, c.path)).json())
  expect(
    (
      await c.request(c.first, path + "/approve", "POST", {
        decision_target: current.decision_target,
      })
    ).status,
  ).toBe(409)
  const body = {
    ...c.body,
    request_key: crypto.randomUUID(),
    existing_expense_id: original.id,
    note: "Legacy receipt",
  }
  expect((await c.request(c.second, "/expense/expenses", "POST", body)).status).toBe(409)
  expect(
    (await c.request(c.requester, "/expense/expenses", "POST", { ...body, amount: 999 })).status,
  ).toBe(409)
  const adopted = await c.request(c.requester, "/expense/expenses", "POST", body)
  expect(adopted.status).toBe(201)
  expect(await adopted.json()).toMatchObject({
    id: original.id,
    note: "Legacy receipt",
    created_at: c.at.toISOString(),
  })
  expect((await c.request(c.requester, "/expense/expenses", "POST", body)).status).toBe(200)
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM system_human_attestations")
      .first<number>("total"),
  ).toBe(0)
})

test("添付の欠落・他人所有・途中保存失敗で経費と案件を残さず再試行できる", async () => {
  const c = await fixture()
  const before = await c.database
    .prepare("SELECT count(*) AS total FROM expenses")
    .first<number>("total")
  const body = { ...c.body, request_key: crypto.randomUUID(), attachment_ids: ["missing-receipt"] }
  expect((await c.request(c.requester, "/expense/expenses", "POST", body)).status).toBe(400)
  expect(
    await c.database.prepare("SELECT count(*) AS total FROM expenses").first<number>("total"),
  ).toBe(before)
  const ownBody = { ...body, attachment_ids: [c.attachmentId] }
  expect((await c.request(c.second, "/expense/expenses", "POST", ownBody)).status).toBe(400)
  await execSql(
    c.database,
    "CREATE TRIGGER fail_expense_link BEFORE INSERT ON expense_attachments BEGIN SELECT RAISE(ABORT,'attachment unavailable'); END",
  )
  expect((await c.request(c.requester, "/expense/expenses", "POST", ownBody)).status).toBe(409)
  expect(
    await c.database.prepare("SELECT count(*) AS total FROM expenses").first<number>("total"),
  ).toBe(before)
  expect(
    await c.database
      .prepare("SELECT status FROM system_attachments WHERE id = ?1")
      .bind(c.attachmentId)
      .first<string>("status"),
  ).toBe("pending")
  await execSql(c.database, "DROP TRIGGER fail_expense_link")
  expect((await c.request(c.requester, "/expense/expenses", "POST", ownBody)).status).toBe(201)
  expect((await c.request(c.requester, "/expense/expenses", "POST", ownBody)).status).toBe(200)
})

test("失効した判断資格・未設定規程・無効Appを受信箱と件数にも反映する", async () => {
  const c = await fixture()
  expect(await (await c.request(c.first, "/company/inbox/counts")).json()).toMatchObject({
    expenses: 1,
    expenses_has_more: false,
  })
  await c.revokeFirstVoting()
  expect((await c.request(c.first, c.path)).status).toBe(403)
  expect(await (await c.request(c.first, "/expense/expenses/inbox")).json()).toMatchObject({
    data: [],
    next_offset: null,
  })
  expect(await (await c.request(c.first, "/company/inbox/counts")).json()).toMatchObject({
    expenses: 0,
  })
  expect(
    await (await c.request(c.second, "/company/inbox/counts", "GET", undefined, "")).json(),
  ).toMatchObject({ expenses: 0, expenses_has_more: false })
  expect(
    (await c.request(c.requester, "/expense/expense-procedures", "GET", undefined, "")).status,
  ).toBe(404)
  await execSql(
    c.database,
    "DELETE FROM system_iam_role_permissions WHERE role_id='bdf8c152-9f77-4cf5-85cf-a3495ca3645d' AND permission_key='expense:submit'",
  )
  expect(
    (
      await c.request(c.requester, "/expense/expenses", "POST", {
        ...c.body,
        request_key: crypto.randomUUID(),
      })
    ).status,
  ).toBe(403)
})

test("経費専用の規程公開は表示版と設定権限を要求し、提出済み案件を変更しない", async () => {
  const c = await fixture()
  const path = "/expense/expense-procedures"
  expect(await (await c.request(c.requester, path)).json()).toMatchObject({ revision: 1 })
  const body = {
    expected_revision: 1,
    workflow: {
      ...c.workflow,
      steps: c.workflow.steps.map((step) => ({ ...step, name: "Updated committee review" })),
    },
  }
  expect((await c.request(c.requester, path, "PUT", body)).status).toBe(200)
  expect((await c.request(c.requester, path, "PUT", body)).status).toBe(409)
  expect(await (await c.request(c.requester, path)).json()).toMatchObject({ revision: 2 })
  expect(
    zExpenseProcedureView.parse(await (await c.request(c.first, c.path)).json()),
  ).toMatchObject({ required_approvals: 2, can_decide: true })
  await execSql(
    c.database,
    "DELETE FROM system_iam_role_permissions WHERE role_id = 'bdf8c152-9f77-4cf5-85cf-a3495ca3645d' AND permission_key = 'expense:procedure:manage'",
  )
  expect(
    (await c.request(c.requester, path, "PUT", { ...body, expected_revision: 2 })).status,
  ).toBe(403)
})

test("実認証APIは書込み停止を409で返し、参照と認証失効を区別する", async () => {
  const c = await fixture()
  const view = zExpenseProcedureView.parse(await (await c.request(c.first, c.path)).json())
  const frozen = await new CreateRecordSourceFreeze({
    repository: openSystemRecordSourceFreezes({ env: c.context.env, assertions: [] }),
  }).execute(
    {
      id: crypto.randomUUID(),
      sourceNamespace: "example-source",
      ownerContext: "expense",
      actorAccountId: c.requester.accountId,
      reason: "Preserve original expense records",
    },
    c.at,
  )
  expect(frozen).toMatchObject({ kind: "created" })
  const responses = [
    await c.request(c.requester, "/expense/expenses", "POST", c.body),
    await c.request(c.first, c.path + "/approve", "POST", {
      decision_target: view.decision_target,
      comment: "Reviewed",
    }),
    await c.request(c.requester, c.path + "/cancel", "POST", {
      decision_target: view.decision_target,
    }),
  ]
  for (const response of responses) {
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: "expense_record_source_frozen" })
  }
  expect((await c.request(c.first, c.path)).status).toBe(200)
  await c.database
    .prepare("UPDATE system_accounts SET token_version=1 WHERE id=?1")
    .bind(c.requester.accountId)
    .run()
  expect((await c.request(c.requester, "/expense/expenses", "POST", c.body)).status).toBe(401)
})

test("部署予算の実認証APIは停止中の全書込みを409で拒否し、解除後に再開する", async () => {
  const c = await fixture()
  const grant = () =>
    c.database
      .prepare(`INSERT OR IGNORE INTO system_iam_role_permissions
    (role_id,permission_key) SELECT role_id,'budget:manage' FROM system_role_bindings WHERE account_id=?1`)
      .bind(c.requester.accountId)
      .run()
  await grant()
  const organizationUnitId = await c.database
    .prepare("SELECT organization_unit_id FROM expenses WHERE id=?1")
    .bind(c.id)
    .first<string>("organization_unit_id")
  const body = {
    organization_unit_id: organizationUnitId,
    fiscal_period: "2026",
    period_start: "2026-04-01",
    period_end: "2027-03-31",
    amount: 100000,
    name: "Annual budget",
    note: null,
  }
  const path = "/expense/expense-budgets"
  const created = await c.request(c.requester, path, "POST", body)
  expect(created.status).toBe(201)
  const id = z.object({ id: z.uuid() }).parse(await created.json()).id
  const original = await c.database
    .prepare("SELECT * FROM expense_budgets WHERE id=?1")
    .bind(id)
    .first()
  if (original === null) throw new Error("created budget is missing")
  const repository = openSystemRecordSourceFreezes({ env: c.context.env, assertions: [] })
  const command = {
    id: crypto.randomUUID(),
    sourceNamespace: "example-source",
    ownerContext: "expense",
    actorAccountId: c.requester.accountId,
    reason: "Preserve budget records",
  }
  expect(await new CreateRecordSourceFreeze({ repository }).execute(command, c.at)).toMatchObject({
    kind: "created",
  })
  for (const response of [
    await c.request(c.requester, path, "POST", { ...body, fiscal_period: "Additional budget" }),
    await c.request(c.requester, `${path}/${id}`, "PATCH", { amount: 200000, name: "Changed" }),
    await c.request(c.requester, `${path}/${id}`, "DELETE"),
  ]) {
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: "expense_record_source_frozen" })
  }
  expect(
    (await c.database.prepare("SELECT * FROM expense_budgets ORDER BY id").all()).results,
  ).toEqual([original])
  expect((await c.request(c.requester, path)).status).toBe(200)
  expect((await c.request(c.requester, `${path}/${id}`)).status).toBe(200)
  await execSql(
    c.database,
    "DELETE FROM system_iam_role_permissions WHERE permission_key='budget:manage'",
  )
  expect((await c.request(c.requester, `${path}/${id}`, "DELETE")).status).toBe(403)
  await grant()
  expect(
    await new ReleaseRecordSourceFreeze({ repository }).execute(
      { ...command, reason: "Resume budget updates" },
      c.at,
    ),
  ).toMatchObject({ kind: "released" })
  expect(
    (await c.request(c.requester, `${path}/${id}`, "PATCH", { amount: 200000, name: "Changed" }))
      .status,
  ).toBe(200)
  expect((await c.request(c.requester, `${path}/${id}`, "DELETE")).status).toBe(204)
  expect((await c.request(c.requester, path, "POST", body)).status).toBe(201)
})
