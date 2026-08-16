import { GetLifecycleState } from "@/contexts/company/application/employee-lifecycle/get-lifecycle-state"
import { createTestContext } from "@/api/test/support/create-test-context"
import { ApplicationError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

describe("GetLifecycleState", () => {
  test("uses the company business date and fails closed until migration is verified", async () => {
    const { context, db } = createTestContext()
    context.env.NOW = "2026-03-31T15:30:00.000Z"
    await db.exec(`
      INSERT INTO employees (id, code, name, status) VALUES (1, 'E001', 'Fixture', 'active');
      UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1;
    `)
    const state = await new GetLifecycleState(context).run({ employeeId: 1 })
    expect(state).not.toBeInstanceOf(ApplicationError)
    expect((state as Exclude<typeof state, ApplicationError>).asOf).toBe("2026-04-01")

    await db.prepare("UPDATE lifecycle_migration_states SET status = 'pending' WHERE id = 1").run()
    const pending = await new GetLifecycleState(context).run({ employeeId: 1 })
    expect(pending).toBeInstanceOf(ApplicationError)
    expect((pending as ApplicationError).code).toBe("lifecycle_migration_incomplete")
  })

  test("accepts an explicit valid as_of and rejects an invalid one", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status) VALUES (1, 'E001', 'Fixture', 'active');
      UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1;
    `)
    const state = await new GetLifecycleState(context).run({ employeeId: 1, asOf: "2027-01-01" })
    expect(state).not.toBeInstanceOf(ApplicationError)
    expect((state as Exclude<typeof state, ApplicationError>).asOf).toBe("2027-01-01")
    const invalid = await new GetLifecycleState(context).run({ employeeId: 1, asOf: "01-01-2027" })
    expect(invalid).toBeInstanceOf(ApplicationError)
  })
})
