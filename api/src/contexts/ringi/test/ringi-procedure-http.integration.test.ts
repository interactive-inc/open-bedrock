import { expect, test } from "bun:test"
import { createRingiProcedureTestContext } from "@/contexts/ringi/test/ringi-procedure.test-support"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { zRingiProcedureView } from "@/contexts/ringi/interface/http/response-schemas"
import { z } from "zod"

async function fixture() {
  const c = await createRingiProcedureTestContext()
  const secret = "ringi-procedure-http-test-secret"
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
      disabledDefaultApps: enabledOptInApps === "" ? "ringi" : undefined,
    })
  }
  const body = {
    request_key: crypto.randomUUID(),
    approver_id: c.first.employeeId,
    title: "Equipment purchase",
    amount: 500,
    reason: "Replace equipment",
  }
  const created = await request(c.requester, "/ringi/ringi-requests", "POST", body)
  const json = await created.json()
  expect(created.status).toBe(201)
  const id = z.object({ id: z.number() }).parse(json).id
  const path = `/ringi/ringi-requests/${id}`
  return { ...c, request, body, id, path }
}

test("実認証APIから提出・受信箱・二名判断・確定・再送を通す", async () => {
  const c = await fixture()
  const replay = await c.request(c.requester, "/ringi/ringi-requests", "POST", c.body)
  expect(replay.status).toBe(200)
  const detail = await c.request(c.first, c.path)
  expect(detail.status).toBe(200)
  const view = zRingiProcedureView.parse(await detail.json())
  expect(view.can_decide).toBe(true)
  expect(view.required_approvals).toBe(2)
  const before = await c.request(c.second, "/ringi/ringi-requests/inbox")
  expect(before.status).toBe(200)
  expect(
    z
      .object({ data: z.array(zRingiProcedureView) })
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
    zRingiProcedureView.parse(await (await c.request(c.requester, c.path)).json()).status,
  ).toBe("approved")
})

test("汎用案件の参照・判断・修復と無効Appから稟議を迂回しない", async () => {
  const c = await fixture()
  const view = zRingiProcedureView.parse(await (await c.request(c.first, c.path)).json())
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
  const view = zRingiProcedureView.parse(await (await c.request(c.requester, c.path)).json())
  const cancelled = await c.request(c.requester, c.path + "/cancel", "POST", {
    decision_target: view.decision_target,
  })
  expect(cancelled.status).toBe(200)
  const mine = await c.request(c.requester, "/ringi/ringi-requests/me?status=cancelled")
  expect(mine.status).toBe(200)
  expect(
    z.object({ data: z.array(zRingiProcedureView), total: z.number() }).parse(await mine.json()),
  ).toMatchObject({ data: [{ id: c.id, status: "cancelled" }], total: 1 })
  await c.database.exec("DELETE FROM system_iam_role_permissions WHERE role_id = 'ringi-test-role'")
  expect(
    (
      await c.request(c.requester, c.path + "/cancel", "POST", {
        decision_target: view.decision_target,
      })
    ).status,
  ).toBe(403)
})

test("差戻し後は元の記録を残して修正版を一度だけ提出する", async () => {
  const c = await fixture()
  const assignment = c.resources.find((resource) => resource.type === "responsibility-assignment")
  if (assignment === undefined) throw new Error("responsibility missing")
  await c.write([
    {
      ...assignment,
      revision: 2,
      attributes: {
        ...assignment.attributes,
        holderType: "employee",
        holderId: c.first.employeeId,
      },
    },
  ])
  await c.database.exec(
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('ringi-test-role', 'ringi:procedure:manage')",
  )
  const definition = await c.request(c.requester, "/ringi/ringi-procedures", "PUT", {
    expected_revision: 1,
    workflow: { version: 1, steps: [{ ...c.step, rejection_behavior: "return" }] },
  })
  expect(definition.status).toBe(200)
  const body = { ...c.body, request_key: crypto.randomUUID(), title: "Review this request" }
  const created = await c.request(c.requester, "/ringi/ringi-requests", "POST", body)
  expect(created.status).toBe(201)
  const id = z.object({ id: z.number() }).parse(await created.json()).id
  const path = `/ringi/ringi-requests/${id}`
  const view = zRingiProcedureView.parse(await (await c.request(c.first, path)).json())
  const returned = await c.request(c.first, path + "/reject", "POST", {
    decision_target: view.decision_target,
    comment: "Revise the reason",
  })
  expect(returned.status).toBe(200)
  expect(await returned.json()).toMatchObject({ status: "returned" })
  expect(
    zRingiProcedureView.parse(await (await c.request(c.requester, path)).json()).can_resubmit,
  ).toBe(true)
  const revision = {
    ...body,
    request_key: crypto.randomUUID(),
    previous_ringi_id: id,
    reason: "Revised reason",
  }
  const otherOwner = await c.request(c.second, "/ringi/ringi-requests", "POST", revision)
  expect(otherOwner.status).toBe(409)
  const revised = await c.request(c.requester, "/ringi/ringi-requests", "POST", revision)
  expect(revised.status).toBe(201)
  const newId = z.object({ id: z.number() }).parse(await revised.json()).id
  expect(newId).not.toBe(id)
  expect((await c.request(c.requester, "/ringi/ringi-requests", "POST", revision)).status).toBe(200)
  expect(
    (
      await c.request(c.requester, "/ringi/ringi-requests", "POST", {
        ...revision,
        request_key: crypto.randomUUID(),
      })
    ).status,
  ).toBe(409)
  const original = zRingiProcedureView.parse(await (await c.request(c.requester, path)).json())
  expect(original).toMatchObject({
    status: "returned",
    reason: body.reason,
    next_ringi_id: newId,
    can_resubmit: false,
  })
  expect(
    await c.database.prepare("SELECT count(*) AS total FROM ringi_requests").first<number>("total"),
  ).toBe(3)
})

test("通知保存に失敗した決裁は確定待ちとして残り、受信箱から再試行できる", async () => {
  const c = await fixture()
  const view = zRingiProcedureView.parse(await (await c.request(c.first, c.path)).json())
  const decision = { decision_target: view.decision_target, comment: "Reviewed" }
  expect((await c.request(c.first, c.path + "/approve", "POST", decision)).status).toBe(200)
  await c.database.exec(
    "CREATE TRIGGER fail_ringi_completion_notification BEFORE INSERT ON system_notification_messages WHEN NEW.title = '稟議が決裁されました' BEGIN SELECT RAISE(ABORT, 'notification unavailable'); END",
  )
  const failed = await c.request(c.second, c.path + "/approve", "POST", decision)
  expect(failed.status).toBe(409)
  const pending = zRingiProcedureView.parse(await (await c.request(c.second, c.path)).json())
  expect(pending).toMatchObject({
    status: "awaiting_execution",
    can_execute: true,
    can_decide: false,
  })
  const inbox = z
    .object({ data: z.array(zRingiProcedureView) })
    .parse(await (await c.request(c.second, "/ringi/ringi-requests/inbox")).json())
  expect(inbox.data.find((entry) => entry.id === c.id)?.can_execute).toBe(true)
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM system_execution_authorizations")
      .first<number>("total"),
  ).toBe(0)
  await c.database.exec("DROP TRIGGER fail_ringi_completion_notification")
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
        "SELECT count(*) AS total FROM system_notification_messages WHERE title = '稟議が決裁されました'",
      )
      .first<number>("total"),
  ).toBe(1)
})

test("機械Principalと規程の別編集入口は人の判断・App規程を変更できない", async () => {
  const c = await fixture()
  const view = zRingiProcedureView.parse(await (await c.request(c.first, c.path)).json())
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
  await c.database.exec(
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('ringi-test-role', 'application_template:manage')",
  )
  const workflow = await c.request(
    c.requester,
    "/company/application-templates/ringi_request/workflow",
    "PUT",
    { expected_revision: 1, version: 1, steps: [c.step] },
  )
  expect(workflow.status).toBe(403)
  expect(
    await c.database
      .prepare(
        "SELECT current_revision FROM system_procedure_definitions WHERE key = 'ringi_request'",
      )
      .first<number>("current_revision"),
  ).toBe(1)
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM system_human_attestations")
      .first<number>("total"),
  ).toBe(0)
})
