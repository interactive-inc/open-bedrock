import { ListLifecycleEvents } from "@/application/employee-lifecycle/list-lifecycle-events"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { PersonnelActionRepository } from "@/infrastructure/employee-lifecycle/personnel-action-repository"
import { describe, expect, test } from "bun:test"

async function fixture() {
  const setup = createTestContext()
  await setup.db.exec(`
    INSERT INTO employees (id, code, name, status) VALUES (1, 'E001', 'Fixture', 'active');
    UPDATE lifecycle_migration_state SET status = 'verified' WHERE id = 1;
    INSERT INTO personnel_actions
      (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
       requested_by_employee_id, source_type, source_application_id, corrects_action_id,
       operation_id, payload_fingerprint, summary_json) VALUES
      ('00000000-0000-4000-8000-000000000001', 1, 'legacy_baseline', '2026-01-01', 1,
       NULL, NULL, 'migration', NULL, NULL, 'operation-1', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
       '{"kind":"legacy_baseline","eventOn":"2026-01-01","department":null,"positionTitle":null,"managerEmployeeCode":null,"status":"active"}'),
      ('00000000-0000-4000-8000-000000000002', 1, 'transferred', '2026-04-01', 2,
       1, 1, 'direct', NULL, NULL, 'operation-2', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
       '{"kind":"transferred","eventOn":"2026-04-01","department":{"code":"D001","name":"Product"},"assignmentType":"primary","positionTitle":"Member","managerEmployeeCode":null}'),
      ('00000000-0000-4000-8000-000000000003', 1, 'leave_started', '2026-07-01', 3,
       1, 1, 'direct', NULL, NULL, 'operation-3', 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
       '{"kind":"leave_started","eventOn":"2026-07-01","status":"leave"}');
  `)
  return setup
}

describe("ListLifecycleEvents", () => {
  test("orders events and keeps a stable snapshot across cursor pages", async () => {
    const { context, db } = await fixture()
    expect(
      await db.prepare("SELECT COUNT(*) AS count FROM personnel_actions").first<number>("count"),
    ).toBe(3)
    expect(
      await new PersonnelActionRepository(context).maxRowIdForEmployee({
        employeeId: 1,
        from: null,
        to: null,
      }),
    ).toBe(3)
    const service = new ListLifecycleEvents(context)
    const first = await service.run({ employeeId: 1, from: null, to: null, limit: 2, cursor: null })
    expect(first).not.toBeInstanceOf(Error)
    if (first instanceof Error) return
    expect(first.data.map((event) => event.eventOn)).toEqual(["2026-07-01", "2026-04-01"])
    expect(first.nextCursor).not.toBeNull()

    await db.exec(`
      INSERT INTO personnel_actions
        (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
         requested_by_employee_id, source_type, source_application_id, corrects_action_id,
         operation_id, payload_fingerprint, summary_json)
      VALUES ('00000000-0000-4000-8000-000000000004', 1, 'returned', '2026-02-01', 4,
              1, 1, 'direct', NULL, NULL, 'operation-4', 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
              '{"kind":"returned","eventOn":"2026-02-01","status":"active"}');
    `)

    const second = await service.run({
      employeeId: 1,
      from: null,
      to: null,
      limit: 2,
      cursor: first.nextCursor,
    })
    expect(second).not.toBeInstanceOf(Error)
    if (second instanceof Error) return
    expect(second.data.map((event) => event.eventOn)).toEqual(["2026-01-01"])
    expect(second.nextCursor).toBeNull()
  })

  test("rejects a cursor reused with different filters", async () => {
    const { context } = await fixture()
    const service = new ListLifecycleEvents(context)
    const first = await service.run({ employeeId: 1, from: null, to: null, limit: 1, cursor: null })
    if (first instanceof Error || first.nextCursor === null) throw new Error("missing cursor")

    const changed = await service.run({
      employeeId: 1,
      from: "2026-04-01",
      to: null,
      limit: 1,
      cursor: first.nextCursor,
    })
    expect(changed).toBeInstanceOf(Error)
    expect((changed as Error & { code: string }).code).toBe("invalid_lifecycle_cursor")
  })
})
