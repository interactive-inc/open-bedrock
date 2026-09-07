import { expect, test, spyOn } from "bun:test"
import { createRingiProcedureTestContext } from "@/contexts/ringi/test/ringi-procedure.test-support"
import { RecordRingiDecision } from "@/contexts/ringi/application/record-ringi-decision"
import { SubmitRingiProcedure } from "@/contexts/ringi/application/submit-ringi-procedure"
import { CancelRingiProcedure } from "@/contexts/ringi/application/cancel-ringi-procedure"
import { PublishRingiProcedure } from "@/contexts/ringi/application/publish-ringi-procedure"
import { RingiRequestRepository } from "@/contexts/ringi/infrastructure/repositories/ringi-request.repository"
import { ConflictError, ForbiddenError } from "@/lib/errors"

async function fixture() {
  const c = await createRingiProcedureTestContext()
  const created = await c.repository.createWithProcedure(c.submission)
  if (created instanceof Error || created.id === null) throw created
  const id = created.id
  const binding = await c.repository.findProcedure(id)
  if (binding instanceof Error || binding === null) throw binding
  const target = {
    proposalVersion: 1,
    proposalDigest: binding.proposalDigest,
    taskKey: c.step.key,
    taskRound: 1,
  }
  const session = (person: typeof c.first) => ({
    accountId: person.accountId,
    employeeId: person.employeeId,
    hasPermission: () => true,
  })
  const decision = (person: typeof c.first) => ({
    ringiId: id,
    session: session(person),
    tokenVersion: 0,
    decisionTarget: target,
    action: "approve" as const,
    comment: "Reviewed",
    decidedAt: c.at,
  })
  return {
    ...c,
    id,
    binding,
    target,
    session,
    decision,
    recorder: new RecordRingiDecision(c.context),
  }
}

test("人数・本人除外・表示版・再送を通して決裁する", async () => {
  const c = await fixture()
  expect(await c.recorder.run(c.decision(c.requester))).toBeInstanceOf(ForbiddenError)
  expect(
    await c.recorder.run({
      ...c.decision(c.first),
      decisionTarget: { ...c.target, proposalDigest: "0".repeat(64) },
    }),
  ).toBeInstanceOf(ConflictError)
  expect(await c.recorder.run(c.decision(c.first))).toEqual({
    status: "pending",
    needsExecution: false,
    replayed: false,
  })
  expect(await c.recorder.run(c.decision(c.first))).toEqual({
    status: "pending",
    needsExecution: false,
    replayed: true,
  })
  expect(await c.recorder.run({ ...c.decision(c.first), action: "reject" })).toBeInstanceOf(
    ConflictError,
  )
  expect(await c.recorder.run(c.decision(c.second))).toEqual({
    status: "approved",
    needsExecution: true,
    replayed: false,
  })
  expect(await c.complete.run(c.command(c.id))).toEqual({ status: "approved", replayed: false })
  expect(await c.recorder.run(c.decision(c.first))).toEqual({
    status: "approved",
    needsExecution: false,
    replayed: true,
  })
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM system_human_attestations")
      .first<number>("total"),
  ).toBe(2)
})

test("保存時の権限失効で判断と監査を巻き戻す", async () => {
  const c = await fixture()
  const original = RingiRequestRepository.prototype.recordDecision.bind(c.repository)
  const spy = spyOn(RingiRequestRepository.prototype, "recordDecision").mockImplementation(
    async function (input) {
      await c.database.exec(
        "DELETE FROM system_iam_role_permissions WHERE role_id = 'ringi-test-role'",
      )
      return original(input)
    },
  )
  try {
    expect(await c.recorder.run(c.decision(c.first))).toBeInstanceOf(ConflictError)
  } finally {
    spy.mockRestore()
  }
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM system_human_attestations")
      .first<number>("total"),
  ).toBe(0)
  expect(await c.repository.findById(c.id)).toMatchObject({ status: "pending" })
})

test("同時再送が一件へ収束し、権限喪失後の再送を拒否する", async () => {
  const c = await fixture()
  const results = await Promise.all([
    c.recorder.run(c.decision(c.first)),
    c.recorder.run(c.decision(c.first)),
  ])
  expect(results.every((result) => !(result instanceof Error))).toBe(true)
  expect(results.filter((result) => !(result instanceof Error) && !result.replayed)).toHaveLength(1)
  await c.database.exec("DELETE FROM system_iam_role_permissions WHERE role_id = 'ringi-test-role'")
  expect(await c.recorder.run(c.decision(c.first))).toBeInstanceOf(ForbiddenError)
})

test("否認の必要人数を満たすと稟議を却下し、監査失敗を巻き戻す", async () => {
  const c = await fixture()
  expect(await c.recorder.run({ ...c.decision(c.first), action: "reject" })).toMatchObject({
    status: "pending",
  })
  await c.database.exec(
    "CREATE TRIGGER fail_ringi_decision_audit BEFORE INSERT ON system_audit_events WHEN NEW.action = 'ringi.request.reject' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
  )
  expect(await c.recorder.run({ ...c.decision(c.second), action: "reject" })).toBeInstanceOf(
    ConflictError,
  )
  expect(await c.repository.findById(c.id)).toMatchObject({ status: "pending" })
  expect(
    await c.database
      .prepare("SELECT count(*) AS total FROM system_human_attestations")
      .first<number>("total"),
  ).toBe(1)
  await c.database.exec("DROP TRIGGER fail_ringi_decision_audit")
  expect(await c.recorder.run({ ...c.decision(c.second), action: "reject" })).toMatchObject({
    status: "rejected",
  })
  expect(await c.repository.findById(c.id)).toMatchObject({
    status: "rejected",
    decisionComment: "Reviewed",
  })
})

test("確認した本人の稟議だけを取り消し、以降の判断を拒否する", async () => {
  const c = await fixture()
  const cancel = new CancelRingiProcedure(c.context)
  const command = {
    ringiId: c.id,
    session: c.session(c.requester),
    tokenVersion: 0,
    decisionTarget: c.target,
    cancelledAt: c.at,
  }
  expect(await cancel.run({ ...command, session: c.session(c.first) })).toBeInstanceOf(
    ForbiddenError,
  )
  expect(
    await cancel.run({ ...command, decisionTarget: { ...c.target, taskRound: 2 } }),
  ).toBeInstanceOf(ConflictError)
  expect(await cancel.run(command)).toEqual({ status: "cancelled", replayed: false })
  expect(await cancel.run(command)).toEqual({ status: "cancelled", replayed: true })
  expect(await c.recorder.run(c.decision(c.first))).toBeInstanceOf(ConflictError)
})

test("旧稟議の番号・内容・起案日を保全して規程へ提出する", async () => {
  const c = await createRingiProcedureTestContext()
  const old = await c.repository.create(c.submission.ringi)
  if (old instanceof Error || old.id === null) throw old
  const submit = new SubmitRingiProcedure(c.context)
  const command = {
    requestKey: crypto.randomUUID(),
    existingRingiId: old.id,
    session: {
      accountId: c.requester.accountId,
      employeeId: c.requester.employeeId,
      hasPermission: () => true,
    },
    tokenVersion: 0,
    approverId: old.approverId,
    title: old.title,
    amount: old.amount,
    reason: old.reason,
    createdAt: new Date(c.at.getTime() + 1000),
  }
  expect(await submit.run({ ...command, title: "Changed" })).toBeInstanceOf(ConflictError)
  expect(await submit.run(command)).toMatchObject({
    request: { id: old.id, createdAt: old.createdAt },
    replayed: false,
  })
  expect(await submit.run(command)).toMatchObject({ request: { id: old.id }, replayed: true })
  expect(
    await c.database.prepare("SELECT count(*) AS total FROM ringi_requests").first<number>("total"),
  ).toBe(1)
})

test("同じ判断対象への同時取消を一回の取消へ収束させる", async () => {
  const c = await fixture()
  const cancel = new CancelRingiProcedure(c.context)
  const command = {
    ringiId: c.id,
    session: c.session(c.requester),
    tokenVersion: 0,
    decisionTarget: c.target,
    cancelledAt: c.at,
  }
  const results = await Promise.all([cancel.run(command), cancel.run(command)])
  expect(results).toEqual(
    expect.arrayContaining([
      { status: "cancelled", replayed: false },
      { status: "cancelled", replayed: true },
    ]),
  )
  expect(
    await cancel.run({
      ...command,
      decisionTarget: { ...c.target, taskRound: 2 },
    }),
  ).toBeInstanceOf(ConflictError)
  expect(await c.recorder.run(c.decision(c.first))).toBeInstanceOf(ConflictError)
})

test("規程設定の権限・期待版・監査の原子性を検査する", async () => {
  const c = await fixture()
  const publish = new PublishRingiProcedure(c.context)
  const command = {
    expectedRevision: 1,
    workflow: { version: 1 as const, steps: [c.step] },
    session: c.session(c.requester),
    tokenVersion: 0,
    publishedAt: c.at,
  }
  expect(await publish.run(command)).toBeInstanceOf(ForbiddenError)
  await c.database.exec(
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('ringi-test-role', 'ringi:procedure:manage')",
  )
  await c.database.exec(
    "CREATE TRIGGER fail_ringi_policy_audit BEFORE INSERT ON system_audit_events WHEN NEW.action = 'ringi.procedure.published' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
  )
  expect(await publish.run(command)).toBeInstanceOf(Error)
  await c.database.exec("DROP TRIGGER fail_ringi_policy_audit")
  expect(await publish.run(command)).toMatchObject({ revision: 2 })
  expect(await publish.run(command)).toBeInstanceOf(ConflictError)
})
