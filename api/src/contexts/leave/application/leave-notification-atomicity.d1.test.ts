import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { createLeaveProcedureDecisionLocalD1Context } from "@/contexts/leave/test/leave-procedure-local-d1.test-support"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

const actions = ["approve", "reject"] as const
const tables = ["leave_decision_notifications", "system_audit_events"] as const
const failures = ["abort", "ignore"] as const
const databaseNames = actions.flatMap((action) =>
  tables.flatMap((table) => failures.map((failure) => `${action}-${table}-${failure}`)),
)

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
  for (const table of tables) {
    test.each([...failures])(
      `${action} ${table} %s: 確定の保存失敗は残数と結果を戻し、再試行で一度だけ反映する`,
      async (failure) => {
        const c = await createLeaveProcedureDecisionLocalD1Context(
          local,
          `${action}-${table}-${failure}`,
        )
        await c.prepareCompletion(action)
        const before = await c.persisted()
        await c.database
          .prepare(
            `CREATE TRIGGER reject_leave_completion BEFORE INSERT ON ${table} BEGIN ${failure === "abort" ? "SELECT RAISE(ABORT, 'completion unavailable');" : "SELECT RAISE(IGNORE);"} END`,
          )
          .run()
        expect(await c.complete(action)).toBeInstanceOf(Error)
        expect(await c.persisted()).toEqual(before)
        expect(
          await c.database
            .prepare("SELECT count(*) AS count FROM system_execution_authorizations")
            .first<number>("count"),
        ).toBe(0)
        await c.database.prepare("DROP TRIGGER reject_leave_completion").run()
        expect(await c.complete(action)).toEqual({
          status: action === "approve" ? "approved" : "rejected",
          replayed: false,
        })
        expect(await c.complete(action)).toEqual({
          status: action === "approve" ? "approved" : "rejected",
          replayed: true,
        })
        expect(await c.persisted()).toEqual({
          status: action === "approve" ? "approved" : "rejected",
          used: action === "approve" ? 1 : 0,
          attestations: 2,
          notifications: 1,
        })
      },
    )
  }
}
