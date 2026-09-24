import { afterAll, beforeAll, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { createLeaveProcedureDecisionLocalD1Context } from "@/contexts/leave/test/leave-procedure-local-d1.test-support"
import { RecordLeaveDecision } from "@/contexts/leave/application/record-leave-decision"
import { LeaveProcedureRepository } from "@/contexts/leave/infrastructure/repositories/leave-procedure.repository"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

const actions = ["approve", "reject"] as const
const timings = ["before", "after-prepare"] as const
const kinds = [
  "missing-human",
  "agent",
  "account",
  "token",
  "permission",
  "company-membership",
] as const
const failures = ["abort", "ignore"] as const
const databaseNames = actions.flatMap((action) => [
  ...timings.flatMap((timing) => kinds.map((kind) => `${action}-${timing}-${kind}`)),
  `${action}-target`,
  ...failures.map((failure) => `${action}-audit-${failure}`),
])

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(120_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: databaseNames })
})

afterAll(async () => {
  await local.dispose()
})

for (const action of actions) {
  for (const timing of timings) {
    test.each([...kinds])(
      `${action} ${timing}: 判断資格の失効で票と残数を変更しない: %s`,
      async (kind) => {
        const c = await createLeaveProcedureDecisionLocalD1Context(
          local,
          `${action}-${timing}-${kind}`,
        )
        const command = c.command(1, action)
        const mutate = async () => {
          if (kind === "missing-human")
            await c.database
              .prepare("DELETE FROM system_principals WHERE account_id = ?1")
              .bind(command.session.accountId)
              .run()
          if (kind === "agent")
            await c.database
              .prepare(
                "UPDATE system_principals SET kind = 'agent', revision = revision + 1 WHERE account_id = ?1",
              )
              .bind(command.session.accountId)
              .run()
          if (kind === "account")
            await c.database
              .prepare(
                "UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1 WHERE id = ?1",
              )
              .bind(command.session.accountId)
              .run()
          if (kind === "token")
            await c.database
              .prepare("UPDATE system_accounts SET token_version = token_version + 1 WHERE id = ?1")
              .bind(command.session.accountId)
              .run()
          if (kind === "permission")
            await c.database
              .prepare("UPDATE system_role_bindings SET revoked_at = ?2 WHERE account_id = ?1")
              .bind(command.session.accountId, c.at.getTime())
              .run()
          if (kind === "company-membership") {
            const membership = c.resources.find(
              (resource) =>
                resource.type === "collective-body-membership" &&
                resource.attributes.employeeId === command.session.employeeId,
            )
            if (membership === undefined || membership.type !== "collective-body-membership")
              throw new Error("membership missing")
            await c.write([
              {
                ...membership,
                revision: 2,
                attributes: { ...membership.attributes, voting: false },
              },
            ])
          }
        }
        const before = await c.persisted()
        const repository = new LeaveProcedureRepository(c.context)
        const save = repository.recordDecision.bind(repository)
        const interception =
          timing === "after-prepare"
            ? spyOn(LeaveProcedureRepository.prototype, "recordDecision").mockImplementationOnce(
                async (input) => {
                  await mutate()
                  return save(input)
                },
              )
            : null
        try {
          if (timing === "before") await mutate()
          expect(await new RecordLeaveDecision(c.context).run(command)).toBeInstanceOf(Error)
          expect(await c.persisted()).toEqual(before)
        } finally {
          interception?.mockRestore()
        }
      },
    )
  }
  test("本人・他人の従業員対応・異なる判断対象を流用できない: " + action, async () => {
    const c = await createLeaveProcedureDecisionLocalD1Context(local, `${action}-target`)
    const command = c.command(1, action)
    const before = await c.persisted()
    const application = new RecordLeaveDecision(c.context)
    expect(await application.run(c.command(0, action))).toBeInstanceOf(Error)
    expect(
      await application.run({
        ...command,
        session: { ...command.session, employeeId: c.creator.employeeId },
      }),
    ).toBeInstanceOf(Error)
    for (const decisionTarget of [
      { ...command.decisionTarget, proposalVersion: 2 },
      { ...command.decisionTarget, proposalDigest: "0".repeat(64) },
      { ...command.decisionTarget, taskKey: "other" },
      { ...command.decisionTarget, taskRound: 2 },
    ])
      expect(await application.run({ ...command, decisionTarget })).toBeInstanceOf(Error)
    expect(await c.persisted()).toEqual(before)
  })
  test.each([...failures])(
    `${action}: 票の監査を保存できなければ判断を戻す: %s`,
    async (failure) => {
      const c = await createLeaveProcedureDecisionLocalD1Context(
        local,
        `${action}-audit-${failure}`,
      )
      const before = await c.persisted()
      await c.database
        .prepare(
          `CREATE TRIGGER reject_leave_vote BEFORE INSERT ON system_audit_events BEGIN ${failure === "abort" ? "SELECT RAISE(ABORT, 'audit unavailable');" : "SELECT RAISE(IGNORE);"} END`,
        )
        .run()
      expect(await c.decide(1, action)).toBeInstanceOf(Error)
      expect(await c.persisted()).toEqual(before)
      await c.database.prepare("DROP TRIGGER reject_leave_vote").run()
      expect(await c.decide(1, action)).not.toBeInstanceOf(Error)
    },
  )
}
