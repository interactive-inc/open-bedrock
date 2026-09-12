import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SystemD1ProcedureDelegationAdapter } from "@system/infrastructure/adapters/workflow/system-d1-procedure-delegation.adapter"
import { zLeaveProcedureView } from "@/contexts/leave/interface/http/response-schemas"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/repositories/leave-request.repository"
import { createTestContextForDatabase } from "@tests/api/support/create-test-context"
import { PublishLeaveProcedure } from "@/contexts/leave/application/publish-leave-procedure"
import { expect, test } from "bun:test"
import { z } from "zod"
import { createLeaveProcedureTestContext } from "@/contexts/leave/test/leave-procedure.test-support"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { leaveProcedureDecisionTargetSchema } from "@/contexts/leave/domain/definitions/leave-procedure-decision-target.definition"

/** 実際のHTTP処理で休暇の提出と判断を検証する。 */
async function fixture() {
  const c = await createLeaveProcedureTestContext()
  const secret = "leave-procedure-flow-http-test-secret"
  await c.database.exec(`INSERT INTO system_iam_roles
(id, key, kind, name, created_at, updated_at) VALUES ('leave-flow', 'test:leave-flow', 'custom', 'Leave flow', 0, 0);
INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('leave-flow', 'leave:submit'), ('leave-flow', 'leave:approve'), ('leave-flow', 'leave:read:all'), ('leave-flow', 'management_dashboard:view');`)
  for (const actor of c.people) {
    await c.database
      .prepare(
        "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES (?1, ?2, 'leave-flow', 0)",
      )
      .bind(`leave-flow:${actor.accountId}`, actor.accountId)
      .run()
  }
  await c.database
    .prepare(
      "INSERT INTO leave_balances (employee_id, fiscal_year, leave_type, granted_days, used_days, remaining_days) VALUES (?1, '2026', 'annual', 10, 0, 10)",
    )
    .bind(c.creator.employeeId)
    .run()
  const path = `/leave/leave-requests/${c.requestId}`
  const request = async (
    actor: typeof c.creator,
    suffix: string,
    body?: unknown,
    method?: string,
  ) => {
    const token = await new SystemAccessTokenIssuer(secret).issue({
      accountId: actor.accountId,
      tokenVersion: 0,
      now: c.at,
    })
    if (token instanceof Error) throw token
    return requestWithContext({
      db: c.database,
      jwtSecret: secret,
      path: suffix.startsWith("/leave/") || suffix.startsWith("/company/") ? suffix : path + suffix,
      method: method ?? (body === undefined ? "GET" : "POST"),
      body,
      token,
      now: c.at.toISOString(),
      enabledOptInApps: "all",
    })
  }
  return { ...c, request }
}

/** 表示と検索がページング前の同じ状態を参照することを検証する。 */
async function expectListedStatus(c: Awaited<ReturnType<typeof fixture>>, status: string) {
  for (const endpoint of ["me", "admin", "?scope=all"]) {
    const path = `/leave/leave-requests${endpoint.startsWith("?") ? endpoint : "/" + endpoint}`
    const separator = path.includes("?") ? "&" : "?"
    const listed = await c.request(c.creator, `${path}${separator}status=${status}&limit=1`)
    expect(listed.status).toBe(200)
    expect(await listed.json()).toMatchObject({ total: 1, data: [{ id: c.requestId, status }] })
    if (status !== "pending") {
      expect(
        await (await c.request(c.creator, `${path}${separator}status=pending`)).json(),
      ).toMatchObject({ total: 0, data: [] })
    }
    expect(
      await (
        await c.request(c.creator, `${path}${separator}status=${status}&limit=1&offset=1`)
      ).json(),
    ).toMatchObject({ total: 1, data: [] })
  }
  expect(await (await c.request(c.creator, "")).json()).toMatchObject({ status })
  const dashboard = await c.request(c.creator, "/company/dashboard/management")
  expect(dashboard.status).toBe(200)
  expect(await dashboard.json()).toMatchObject({
    leave_pending_count: status === "pending" ? 1 : 0,
  })
}

test.each(["approve", "reject"] as const)(
  "実認証で休暇の確認・提出・二名判断・確定と再送を通す: %s",
  async (action) => {
    const c = await fixture()
    const request = c.request
    const preview = await request(c.creator, "/procedure")
    expect(preview.status).toBe(200)
    const confirmed = z
      .object({ confirmed_content_digest: z.string(), can_submit: z.boolean() })
      .parse(await preview.json())
    expect(confirmed.can_submit).toBe(true)
    await expectListedStatus(c, "draft")
    expect(await (await request(c.creator, "/leave/leave-requests/me")).json()).toMatchObject({
      data: [{ id: c.requestId, status: "draft" }],
    })
    const submission = {
      request_key: crypto.randomUUID(),
      previous_leave_request_id: null,
      confirmed_content_digest: confirmed.confirmed_content_digest,
    }
    expect(
      (
        await request(c.creator, "/submit", {
          ...submission,
          confirmed_content_digest: "0".repeat(64),
        })
      ).status,
    ).toBe(409)
    expect((await request(c.creator, "/submit", submission)).status).toBe(201)
    expect((await request(c.creator, "/submit", submission)).status).toBe(200)
    await expectListedStatus(c, "pending")
    const first = c.people[1]
    const second = c.people[2]
    if (first === undefined || second === undefined) throw new Error("decision candidates missing")
    const view = z
      .object({
        decision_target: leaveProcedureDecisionTargetSchema,
        can_decide: z.boolean(),
        required_approvals: z.number(),
      })
      .parse(await (await request(first, "/procedure")).json())
    const inbox = await request(first, "/leave/leave-requests/inbox")
    expect(inbox.status).toBe(200)
    expect(
      z
        .object({ data: z.array(zLeaveProcedureView) })
        .parse(await inbox.json())
        .data.map((entry) => entry.decision_target),
    ).toEqual([view.decision_target])
    expect(await (await request(c.creator, "/leave/leave-requests/inbox")).json()).toEqual({
      data: [],
      next_offset: null,
    })
    expect(await (await request(first, "/company/inbox/counts")).json()).toMatchObject({
      leaves: 1,
      leaves_has_more: false,
    })
    expect(await (await request(c.creator, "/company/inbox/counts")).json()).toMatchObject({
      leaves: 0,
      leaves_has_more: false,
    })
    expect(view.can_decide).toBe(true)
    expect(view.required_approvals).toBe(2)
    const decision = { decision_target: view.decision_target, action, comment: "Reviewed" }
    expect((await request(c.creator, "/procedure/decisions", decision)).status).toBe(403)
    expect(
      (
        await request(first, "/procedure/decisions", {
          ...decision,
          decision_target: { ...decision.decision_target, proposal_digest: "0".repeat(64) },
        })
      ).status,
    ).toBe(409)
    const firstDecision = await request(first, "/procedure/decisions", decision)
    expect(firstDecision.status).toBe(200)
    expect(await firstDecision.json()).toMatchObject({ status: "pending" })
    expect(await (await request(first, "/leave/leave-requests/inbox")).json()).toEqual({
      data: [],
      next_offset: null,
    })
    expect(await (await request(first, "/company/inbox/counts")).json()).toMatchObject({
      leaves: 0,
      leaves_has_more: false,
    })
    const secondDecision = await request(second, "/procedure/decisions", decision)
    expect(secondDecision.status).toBe(200)
    await expectListedStatus(c, action === "approve" ? "approved" : "rejected")
    expect(await secondDecision.json()).toMatchObject({
      status: action === "approve" ? "approved" : "rejected",
    })
    expect((await request(second, "/procedure/decisions", decision)).status).toBe(200)
    expect(await (await request(second, "/leave/leave-requests/inbox")).json()).toEqual({
      data: [],
      next_offset: null,
    })
    expect(
      await c.database
        .prepare("SELECT count(*) AS count FROM leave_decision_notifications")
        .first<number>("count"),
    ).toBe(1)
    expect(
      await c.database
        .prepare("SELECT remaining_days FROM leave_balances WHERE employee_id = ?1")
        .bind(c.creator.employeeId)
        .first<number>("remaining_days"),
    ).toBe(action === "approve" ? 9 : 10)
  },
)

test("本人の取消は履歴を残し、同じ期間の再申請を妨げない", async () => {
  const c = await fixture()
  const view = await (await c.request(c.creator, "/procedure")).json()
  const confirmed = z.object({ confirmed_content_digest: z.string() }).parse(view)
  const submitted = await c.request(c.creator, "/submit", {
    request_key: crypto.randomUUID(),
    previous_leave_request_id: null,
    confirmed_content_digest: confirmed.confirmed_content_digest,
  })
  if (submitted.status !== 201) throw new Error(JSON.stringify(await submitted.json()))
  expect(submitted.status).toBe(201)
  const target = z
    .object({ decision_target: leaveProcedureDecisionTargetSchema })
    .parse(await (await c.request(c.creator, "/procedure")).json()).decision_target
  expect(
    (
      await c.request(
        c.creator,
        "",
        {
          leave_type: "annual",
          start_date: "2027-01-01",
          end_date: "2027-01-01",
          unit: "full_day",
          hours: null,
          reason: "Changed",
        },
        "PUT",
      )
    ).status,
  ).toBe(409)
  expect((await c.request(c.creator, "", undefined, "DELETE")).status).toBe(409)
  const stranger = c.people[1]
  if (stranger === undefined) throw new Error("actor missing")
  expect((await c.request(stranger, "/procedure/cancel", { decision_target: target })).status).toBe(
    403,
  )
  expect(
    (
      await c.request(c.creator, "/procedure/cancel", {
        decision_target: { ...target, task_round: 2 },
      })
    ).status,
  ).toBe(409)
  expect(
    (await c.request(c.creator, "/procedure/cancel", { decision_target: target })).status,
  ).toBe(200)
  expect(
    (await c.request(c.creator, "/procedure/cancel", { decision_target: target })).status,
  ).toBe(200)
  expect(await (await c.request(c.creator, "/procedure")).json()).toMatchObject({
    status: "cancelled",
  })
  expect(await (await c.request(c.creator, "/leave/leave-requests/me")).json()).toMatchObject({
    data: [{ id: c.requestId, status: "cancelled" }],
  })
  await expectListedStatus(c, "cancelled")
  const repository = new LeaveRequestRepository(createTestContextForDatabase(c.database))
  expect(
    await repository.findOverlapping({
      employeeId: c.creator.employeeId,
      startDate: "2027-01-01",
      endDate: "2027-01-01",
    }),
  ).toEqual([])
  expect(await repository.findById(c.requestId)).not.toBeNull()
  expect(
    await c.database
      .prepare("SELECT count(*) AS count FROM leave_decision_notifications")
      .first<number>("count"),
  ).toBe(0)
})

test("差戻し後に修正した休暇を別番号で再提出し、元の内容を保つ", async () => {
  const c = await fixture()
  await c.database.exec(
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('leave-flow', 'leave:procedure:manage')",
  )
  const participant = c.people[1]
  if (participant === undefined) throw new Error("participant missing")
  const assignment = c.resources.find((resource) => resource.type === "responsibility-assignment")
  if (assignment === undefined || assignment.type !== "responsibility-assignment")
    throw new Error("assignment missing")
  await c.write([
    {
      ...assignment,
      revision: 3,
      attributes: {
        ...assignment.attributes,
        holderType: "employee",
        holderId: participant.employeeId,
        authorityScopeId: null,
      },
    },
  ])
  const base = createTestContextForDatabase(c.database)
  const published = await new PublishLeaveProcedure(base).run({
    expectedRevision: 1,
    workflow: { version: 1, steps: [{ ...c.step, rejection_behavior: "return" }] },
    session: {
      accountId: c.creator.accountId,
      employeeId: c.creator.employeeId,
      hasPermission: () => true,
    },
    tokenVersion: 0,
    publishedAt: c.at,
  })
  expect(published).not.toBeInstanceOf(Error)
  const confirmed = z
    .object({ confirmed_content_digest: z.string() })
    .parse(await (await c.request(c.creator, "/procedure")).json())
  const submitted = await c.request(c.creator, "/submit", {
    request_key: crypto.randomUUID(),
    previous_leave_request_id: null,
    confirmed_content_digest: confirmed.confirmed_content_digest,
  })
  if (submitted.status !== 201) throw new Error(JSON.stringify(await submitted.json()))
  expect(submitted.status).toBe(201)
  const actor = c.people[1]
  if (actor === undefined) throw new Error("actor missing")
  const target = z
    .object({ decision_target: leaveProcedureDecisionTargetSchema })
    .parse(await (await c.request(actor, "/procedure")).json()).decision_target
  const returned = await c.request(actor, "/procedure/decisions", {
    action: "reject",
    comment: "日程を再確認",
    decision_target: target,
  })
  expect(returned.status).toBe(200)
  expect(await returned.json()).toMatchObject({ status: "returned" })
  await expectListedStatus(c, "returned")
  const draft = await c.request(c.creator, "/leave/leave-requests", {
    previous_leave_request_id: c.requestId,
    leave_type: "annual",
    start_date: "2027-01-01",
    end_date: "2027-01-01",
    unit: "full_day",
    hours: null,
    reason: "再確認済み",
  })
  expect(draft.status).toBe(201)
  const id = z.object({ id: z.number() }).parse(await draft.json()).id
  const path = `/leave/leave-requests/${id}`
  const revised = z
    .object({ confirmed_content_digest: z.string() })
    .parse(await (await c.request(c.creator, path + "/procedure")).json())
  expect(await (await c.request(c.creator, path + "/procedure")).json()).toMatchObject({
    previous_leave_request_id: c.requestId,
    can_submit: true,
  })
  const sourceFailure = await (async () =>
    c.database
      .prepare("UPDATE leave_requests SET previous_leave_request_id = NULL WHERE id = ?1")
      .bind(id)
      .run())().then(
    () => null,
    (error: unknown) => error,
  )
  expect(sourceFailure).toMatchObject({
    message: expect.stringContaining("leave_draft_source_immutable"),
  })
  const submission = {
    request_key: crypto.randomUUID(),
    previous_leave_request_id: c.requestId,
    confirmed_content_digest: revised.confirmed_content_digest,
  }
  expect(
    (
      await c.request(c.creator, path + "/submit", {
        ...submission,
        previous_leave_request_id: null,
      })
    ).status,
  ).toBe(409)
  expect((await c.request(c.creator, path + "/submit", submission)).status).toBe(201)
  expect((await c.request(c.creator, path + "/submit", submission)).status).toBe(200)
  expect(await (await c.request(c.creator, "/procedure")).json()).toMatchObject({
    status: "returned",
    reason: "Leave",
    next_leave_request_id: id,
    can_resubmit: false,
  })
  expect(await (await c.request(c.creator, path + "/procedure")).json()).toMatchObject({
    status: "pending",
    previous_leave_request_id: c.requestId,
    reason: "再確認済み",
  })
})

test.each([
  { type: "annual", unit: "half_day_am", hours: null, consumed: 0.5, used: 0.5 },
  { type: "annual", unit: "hourly", hours: 2, consumed: 0.25, used: 0.25 },
  { type: "compensatory", unit: "full_day", hours: null, consumed: 1, used: 0 },
])("取得単位を固定したSystem承認が必要な残数だけを消費する: %j", async (kind) => {
  const c = await fixture()
  await c.database
    .prepare(
      "UPDATE leave_requests SET leave_type = ?2, unit = ?3, hours = ?4, consumed_days = ?5 WHERE id = ?1",
    )
    .bind(c.requestId, kind.type, kind.unit, kind.hours, kind.consumed)
    .run()
  const preview = zLeaveProcedureView.parse(await (await c.request(c.creator, "/procedure")).json())
  expect(
    (
      await c.request(c.creator, "/submit", {
        request_key: crypto.randomUUID(),
        previous_leave_request_id: null,
        confirmed_content_digest: preview.confirmed_content_digest,
      })
    ).status,
  ).toBe(201)
  for (const actor of c.people.slice(1, 3)) {
    const view = zLeaveProcedureView.parse(await (await c.request(actor, "/procedure")).json())
    expect(
      (
        await c.request(actor, "/procedure/decisions", {
          decision_target: view.decision_target,
          action: "approve",
          comment: null,
        })
      ).status,
    ).toBe(200)
  }
  expect(
    await c.database
      .prepare("SELECT used_days FROM leave_balances WHERE employee_id = ?1")
      .bind(c.creator.employeeId)
      .first<number>("used_days"),
  ).toBe(kind.used)
  expect(await (await c.request(c.creator, "/procedure")).json()).toMatchObject({
    status: "approved",
    unit: kind.unit,
    hours: kind.hours,
    consumed_days: kind.consumed,
  })
})

test.each(["approve", "reject"])(
  "旧直接判断URLを廃止し、未提出の休暇を確定させない: %s",
  async (action) => {
    const c = await fixture()
    const actor = c.people[1]
    if (actor === undefined) throw new Error("actor missing")
    expect(
      (
        await c.request(actor, `/${action}`, {
          decision_target: { request_id: c.requestId, request_digest: "a".repeat(64) },
          comment: null,
        })
      ).status,
    ).toBe(404)
    expect(
      await c.database
        .prepare("SELECT status FROM leave_requests WHERE id = ?1")
        .bind(c.requestId)
        .first<string>("status"),
    ).toBe("pending")
    expect(
      await c.database
        .prepare("SELECT count(*) AS count FROM system_human_attestations")
        .first<number>("count"),
    ).toBe(0)
  },
)

test("二段階の承認では最後の段階だけが残数を確定し、古い段階への再送で票を増やさない", async () => {
  const c = await fixture()
  await c.database.exec(
    "INSERT INTO system_iam_role_permissions (role_id,permission_key) VALUES ('leave-flow','leave:procedure:manage')",
  )
  const base = createTestContextForDatabase(c.database)
  const published = await new PublishLeaveProcedure(base).run({
    expectedRevision: 1,
    workflow: { version: 1, steps: [c.step, { ...c.step, key: "final-review", name: "最終確認" }] },
    session: {
      accountId: c.creator.accountId,
      employeeId: c.creator.employeeId,
      hasPermission: () => true,
    },
    tokenVersion: 0,
    publishedAt: c.at,
  })
  expect(published).not.toBeInstanceOf(Error)
  const preview = zLeaveProcedureView.parse(await (await c.request(c.creator, "/procedure")).json())
  expect(
    (
      await c.request(c.creator, "/submit", {
        request_key: crypto.randomUUID(),
        previous_leave_request_id: null,
        confirmed_content_digest: preview.confirmed_content_digest,
      })
    ).status,
  ).toBe(201)
  const first = c.people[1]
  if (first === undefined) throw new Error("actor missing")
  const original = zLeaveProcedureView.parse(
    await (await c.request(first, "/procedure")).json(),
  ).decision_target
  for (const key of [c.step.key, "final-review"]) {
    for (const actor of c.people.slice(1, 3)) {
      const view = zLeaveProcedureView.parse(await (await c.request(actor, "/procedure")).json())
      expect(view.decision_target?.task_key).toBe(key)
      expect(
        (
          await c.request(actor, "/procedure/decisions", {
            decision_target: view.decision_target,
            action: "approve",
            comment: null,
          })
        ).status,
      ).toBe(200)
    }
    expect(
      await c.database
        .prepare("SELECT used_days FROM leave_balances WHERE employee_id = ?1")
        .bind(c.creator.employeeId)
        .first<number>("used_days"),
    ).toBe(key === c.step.key ? 0 : 1)
    if (key === c.step.key) {
      expect(
        (
          await c.request(first, "/procedure/decisions", {
            decision_target: original,
            action: "approve",
            comment: null,
          })
        ).status,
      ).toBe(200)
      expect(
        await c.database
          .prepare("SELECT count(*) AS count FROM system_human_attestations")
          .first<number>("count"),
      ).toBe(2)
    }
  }
  const completed = zLeaveProcedureView.parse(
    await (await c.request(c.creator, "/procedure")).json(),
  )
  expect(completed).toMatchObject({
    status: "approved",
    decision_target: { task_key: "final-review" },
  })
  expect(completed.decisions).toHaveLength(4)
  expect(new Set(completed.decisions.map((decision) => decision.actor_account_id)).size).toBe(2)
  expect(completed.decisions.every((decision) => decision.actor_name !== null)).toBe(true)
})

test("委任による判断は本人と代理先を記録し、確定前の委任失効で残数消費を拒否する", async () => {
  const c = await fixture()
  const first = c.people[1],
    delegate = c.people[3]
  if (first === undefined || delegate === undefined) throw new Error("actors missing")
  const assignment = c.resources.find((resource) => resource.type === "responsibility-assignment")
  if (assignment === undefined || assignment.type !== "responsibility-assignment")
    throw new Error("assignment missing")
  await c.write([
    {
      ...assignment,
      revision: 3,
      attributes: {
        ...assignment.attributes,
        holderType: "employee",
        holderId: first.employeeId,
        authorityScopeId: null,
        delegationAllowed: true,
      },
    },
  ])
  const delegated = await new SystemD1ProcedureDelegationAdapter(c.context).create({
    delegatorAccountId: first.accountId,
    delegateAccountId: delegate.accountId,
    procedureKey: procedureKeySchema.parse("leave_request"),
    startsAt: c.at,
    endsAt: new Date(c.at.getTime() + 3600000),
    createdAt: c.at,
  })
  if (delegated instanceof Error || delegated === "overlap")
    throw new Error("delegation fixture failed", { cause: delegated })
  const delegation = { id: delegated.number }
  const preview = zLeaveProcedureView.parse(await (await c.request(c.creator, "/procedure")).json())
  expect(
    (
      await c.request(c.creator, "/submit", {
        request_key: crypto.randomUUID(),
        previous_leave_request_id: null,
        confirmed_content_digest: preview.confirmed_content_digest,
      })
    ).status,
  ).toBe(201)
  const inbox = z
    .object({ data: z.array(zLeaveProcedureView) })
    .parse(await (await c.request(delegate, "/leave/leave-requests/inbox")).json())
  expect(inbox.data).toHaveLength(1)
  const target = inbox.data[0]?.decision_target
  await c.database.exec(
    "CREATE TRIGGER prevent_leave_delivery BEFORE INSERT ON leave_decision_notifications BEGIN SELECT RAISE(ABORT,'delivery unavailable'); END",
  )
  const decision = await c.request(delegate, "/procedure/decisions", {
    decision_target: target,
    action: "approve",
    comment: "代理で確認",
  })
  expect(decision.status).toBeGreaterThanOrEqual(400)
  await expectListedStatus(c, "awaiting_execution")
  const approved = zLeaveProcedureView.parse(await (await c.request(delegate, "/procedure")).json())
  expect(approved).toMatchObject({
    status: "awaiting_execution",
    can_execute: true,
    decisions: [{ actor_account_id: delegate.accountId, represented_account_id: first.accountId }],
  })
  expect(
    (await c.request(first, `/company/approval-delegations/${delegation.id}`, undefined, "DELETE"))
      .status,
  ).toBe(204)
  await c.database.exec("DROP TRIGGER prevent_leave_delivery")
  expect(
    (await c.request(delegate, "/procedure/complete", { decision_target: target })).status,
  ).toBe(403)
  expect(
    await c.database
      .prepare("SELECT used_days FROM leave_balances WHERE employee_id = ?1")
      .bind(c.creator.employeeId)
      .first<number>("used_days"),
  ).toBe(0)
  expect(
    await c.database
      .prepare("SELECT status FROM leave_requests WHERE id = ?1")
      .bind(c.requestId)
      .first<string>("status"),
  ).toBe("pending")
})

test("未提出の記録をDBから直接判断へ変更できない", async () => {
  const c = await fixture()
  for (const status of ["approved", "rejected"]) {
    const failure = await (async () =>
      c.database
        .prepare("UPDATE leave_requests SET status = ?2 WHERE id = ?1")
        .bind(c.requestId, status)
        .run())().then(
      () => null,
      (error: unknown) => error,
    )
    expect(failure).toMatchObject({ message: expect.stringContaining("leave_procedure_required") })
  }
  expect(
    await c.database
      .prepare("SELECT status FROM leave_requests WHERE id = ?1")
      .bind(c.requestId)
      .first<string>("status"),
  ).toBe("pending")
})

test("確認対象の欠落・旧形式をHTTPの入力段階で拒否する", async () => {
  const c = await fixture()
  const actor = c.people[1]
  if (actor === undefined) throw new Error("actor missing")
  for (const target of [
    undefined,
    null,
    {},
    { request_id: c.requestId, request_digest: "a".repeat(64) },
    { proposal_version: 0, proposal_digest: "a".repeat(64), task_key: "review", task_round: 1 },
  ]) {
    expect(
      (
        await c.request(actor, "/procedure/decisions", {
          action: "approve",
          comment: null,
          decision_target: target,
        })
      ).status,
    ).toBe(400)
  }
  expect(
    await c.database
      .prepare("SELECT count(*) AS count FROM system_human_attestations")
      .first<number>("count"),
  ).toBe(0)
})
