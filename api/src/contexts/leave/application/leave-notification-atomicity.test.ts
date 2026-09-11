import { expect, test } from "bun:test"
import { createLeaveProcedureDecisionTestContext } from "@/contexts/leave/test/leave-procedure-decision.test-support"

for (const action of ["approve", "reject"] as const) {
  for (const table of ["leave_decision_notifications", "system_audit_events"]) {
    test.each(["abort", "ignore"])(
      `${action} ${table} %s: 確定の保存失敗は残数と結果を戻し、再試行で一度だけ反映する`,
      async (failure) => {
        const c = await createLeaveProcedureDecisionTestContext()
        await c.prepareCompletion(action)
        const before = await c.persisted()
        await c.database.exec(
          `CREATE TRIGGER reject_leave_completion BEFORE INSERT ON ${table} BEGIN ${failure === "abort" ? "SELECT RAISE(ABORT, 'completion unavailable');" : "SELECT RAISE(IGNORE);"} END`,
        )
        expect(await c.complete(action)).toBeInstanceOf(Error)
        expect(await c.persisted()).toEqual(before)
        expect(
          await c.database
            .prepare("SELECT count(*) AS count FROM system_execution_authorizations")
            .first<number>("count"),
        ).toBe(0)
        await c.database.exec("DROP TRIGGER reject_leave_completion")
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
