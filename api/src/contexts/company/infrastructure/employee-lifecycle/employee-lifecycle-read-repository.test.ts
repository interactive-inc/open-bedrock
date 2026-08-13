import { EmployeeLifecycleReadRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-read-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { ApplicationError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

async function setupTimeline() {
  const setup = createTestContext()
  await setup.db.exec(`
    INSERT INTO departments (id, name) VALUES (1, 'Product'), (2, 'Sales');
    INSERT INTO org_departments
      (code, department_id, parent_code, manager_employee_code, sort_order)
    VALUES ('D001', 1, NULL, NULL, 1), ('D002', 2, NULL, NULL, 2);
    INSERT INTO employees (id, code, name, status) VALUES
      (1, 'E001', 'Fixture One', 'active'), (2, 'E002', 'Fixture Two', 'active');
    INSERT INTO personnel_actions
      (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
       requested_by_employee_id, source_type, source_application_id, corrects_action_id,
       operation_id, payload_fingerprint, summary_json)
    VALUES ('fixture-action', 1, 'legacy_baseline', '2026-01-01', 1, NULL, NULL,
            'migration', NULL, NULL, 'fixture-read-action',
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '{}');
    INSERT INTO employment_period_versions
      (period_id, revision, employee_id, starts_on, ends_on, is_void,
       recorded_by_action_id, recorded_at) VALUES
      ('employment-1', 1, 1, '2026-04-01', '2026-10-02', 0, 'fixture-action', 1),
      ('employment-2', 1, 1, '2026-12-01', NULL, 0, 'fixture-action', 1),
      ('employment-manager', 1, 2, '2026-01-01', NULL, 0, 'fixture-action', 1);
    INSERT INTO employee_status_period_versions
      (period_id, revision, employment_period_id, employee_id, status, starts_on,
       ends_on, is_void, recorded_by_action_id, recorded_at) VALUES
      ('status-active-1', 1, 'employment-1', 1, 'active', '2026-04-01', '2026-07-01', 0, 'fixture-action', 1),
      ('status-leave', 1, 'employment-1', 1, 'leave', '2026-07-01', '2026-08-01', 0, 'fixture-action', 1),
      ('status-active-2', 1, 'employment-1', 1, 'active', '2026-08-01', '2026-10-02', 0, 'fixture-action', 1),
      ('status-rehire', 1, 'employment-2', 1, 'active', '2026-12-01', NULL, 0, 'fixture-action', 1),
      ('status-manager', 1, 'employment-manager', 2, 'active', '2026-01-01', NULL, 0, 'fixture-action', 1);
    INSERT INTO employee_org_assignment_period_versions
      (period_id, revision, employment_period_id, employee_id, department_code,
       assignment_type, position_title, manager_employee_id, starts_on, ends_on,
       is_void, recorded_by_action_id, recorded_at) VALUES
      ('assignment-primary-1', 1, 'employment-1', 1, 'D001', 'primary', 'Member', 2, '2026-04-01', '2026-06-01', 0, 'fixture-action', 1),
      ('assignment-primary-2', 1, 'employment-1', 1, 'D002', 'primary', 'Lead', 2, '2026-06-01', '2026-10-02', 0, 'fixture-action', 1),
      ('assignment-concurrent', 1, 'employment-1', 1, 'D001', 'concurrent', 'Advisor', NULL, '2026-06-01', '2026-10-02', 0, 'fixture-action', 1),
      ('assignment-rehire', 1, 'employment-2', 1, 'D001', 'primary', 'Member', 2, '2026-12-01', NULL, 0, 'fixture-action', 1),
      ('assignment-manager', 1, 'employment-manager', 2, 'D001', 'primary', 'Manager', NULL, '2026-01-01', NULL, 0, 'fixture-action', 1);
    INSERT INTO employee_lifecycle_revisions (employee_id, revision, updated_at)
    VALUES (1, 8, 1), (2, 1, 1);
    UPDATE organization_lifecycle_states SET revision = 11, updated_at = 1 WHERE id = 1;
    UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1;
  `)
  return setup
}

describe("EmployeeLifecycleReadRepository", () => {
  test("derives future hire, active, leave, retirement boundary, and rehire states", async () => {
    const { context } = await setupTimeline()
    const repository = new EmployeeLifecycleReadRepository(context)
    const cases = [
      ["2026-03-31", "prehire"],
      ["2026-04-01", "active"],
      ["2026-07-01", "leave"],
      ["2026-10-01", "active"],
      ["2026-10-02", "retired"],
      ["2026-12-01", "active"],
    ] as const

    for (const [asOf, status] of cases) {
      const states = await repository.findStatesAt([1], asOf)
      expect(states).not.toBeInstanceOf(ApplicationError)
      expect((states as Exclude<typeof states, ApplicationError>).get(1)?.status).toBe(status)
    }
  })

  test("returns primary and concurrent assignments, manager, archive, and revisions", async () => {
    const { context, db } = await setupTimeline()
    await db
      .prepare("UPDATE employees SET archived_at = 1, archived_by_account_id = 1 WHERE id = 1")
      .run()

    const states = await new EmployeeLifecycleReadRepository(context).findStatesAt(
      [1],
      "2026-06-01",
    )
    expect(states).not.toBeInstanceOf(ApplicationError)
    expect((states as Exclude<typeof states, ApplicationError>).get(1)).toEqual(
      expect.objectContaining({
        status: "active",
        archived: true,
        employeeRevision: 8,
        organizationRevision: 11,
        primaryAssignment: expect.objectContaining({
          departmentCode: "D002",
          departmentName: "Sales",
          positionTitle: "Lead",
          managerEmployeeId: 2,
          managerEmployeeCode: "E002",
        }),
        concurrentAssignments: [
          expect.objectContaining({ departmentCode: "D001", positionTitle: "Advisor" }),
        ],
      }),
    )
  })

  test("loads many employees without per-employee queries", async () => {
    const setup = await setupTimeline()
    let queryCount = 0
    const context = {
      ...setup.context,
      env: {
        ...setup.context.env,
        DB: new Proxy(setup.db, {
          get(target, property, receiver) {
            if (property === "prepare") {
              return (query: string) => {
                queryCount += 1
                return target.prepare(query)
              }
            }
            return Reflect.get(target, property, receiver)
          },
        }),
      },
    }

    const states = await new EmployeeLifecycleReadRepository(context).findStatesAt(
      [1, 2],
      "2026-06-01",
    )
    expect(states).not.toBeInstanceOf(ApplicationError)
    expect((states as Exclude<typeof states, ApplicationError>).size).toBe(2)
    expect(queryCount).toBeLessThanOrEqual(7)
  })
})
