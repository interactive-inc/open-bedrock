import { GetLifecycleState } from "@/contexts/company-compatibility/application/employee-lifecycle/get-lifecycle-state"
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
    expect((state as Exclude<typeof state, ApplicationError>).status).toBe("prehire")

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

  test("uses the common workforce state and preserves lifecycle display fields", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status)
      VALUES (1, 'E001', 'Fixture', 'active');
      INSERT INTO departments (id, name) VALUES (1, 'Engineering');
      INSERT INTO org_departments (code, department_id, sort_order)
      VALUES ('ENG', 1, 1);
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at)
      VALUES ('employment-1', 1, 1, '2026-01-01', NULL, 0, 'action-1', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('status-1', 1, 'employment-1', 1, 'leave', '2026-01-01',
              NULL, 0, 'action-1', 1);
      INSERT INTO employee_org_assignment_period_versions
        (period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at)
      VALUES ('assignment-1', 1, 'employment-1', 1, 'ENG', 'primary', 'Engineer',
              NULL, '2026-01-01', NULL, 0, 'action-1', 1);
      UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1;
    `)

    const state = await new GetLifecycleState(context).run({ employeeId: 1, asOf: "2026-04-01" })

    expect(state).not.toBeInstanceOf(ApplicationError)
    expect(state).toEqual(
      expect.objectContaining({
        employeeCode: "E001",
        status: "leave",
        employmentPeriodId: "employment-1",
        primaryAssignment: expect.objectContaining({
          periodId: "assignment-1",
          departmentCode: "ENG",
          departmentName: "Engineering",
          positionTitle: "Engineer",
        }),
      }),
    )
  })

  test("fails closed when an active employment has no status period", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status)
      VALUES (1, 'E001', 'Fixture', 'active');
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at)
      VALUES ('employment-1', 1, 1, '2026-01-01', NULL, 0, 'action-1', 1);
      UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1;
    `)

    const state = await new GetLifecycleState(context).run({ employeeId: 1, asOf: "2026-04-01" })

    expect(state).toBeInstanceOf(ApplicationError)
    expect((state as ApplicationError).code).toBe("lifecycle_projection_mismatch")
  })

  test("fails closed when a canonical assignment has no display projection", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status)
      VALUES (1, 'E001', 'Fixture', 'active');
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at)
      VALUES ('employment-1', 1, 1, '2026-01-01', NULL, 0, 'action-1', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('status-1', 1, 'employment-1', 1, 'active', '2026-01-01',
              NULL, 0, 'action-1', 1);
      INSERT INTO departments (id, name) VALUES (1, 'Hidden projection');
      INSERT INTO org_departments (code, department_id, sort_order)
      VALUES ('HIDDEN', 1, 1);
      INSERT INTO organization_change_operations
        (id, expected_revision, change_count, applied_count,
         resulting_revision, status, recorded_at)
      SELECT 'canonical-assignment', revision, 1, 0, revision + 1, 'PENDING', 1
      FROM organization_lifecycle_states WHERE id = 1;
      INSERT INTO organization_assignment_period_versions
        (period_id, revision, employment_id, employee_id, organization_unit_id,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at)
      VALUES ('canonical-assignment-period', 1, 'employment:employment-1', 'employee:1',
              'department:HIDDEN', 'PRIMARY', NULL, NULL, '2026-01-01', NULL,
              0, 'canonical-assignment', 1);
      UPDATE organization_change_operations SET status = 'COMPLETED'
      WHERE id = 'canonical-assignment';
      UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1;
    `)

    const state = await new GetLifecycleState(context).run({ employeeId: 1, asOf: "2026-04-01" })

    expect(state).toBeInstanceOf(ApplicationError)
    expect((state as ApplicationError).code).toBe("lifecycle_projection_mismatch")
  })
})
