import { EmployeeLifecycleRepository } from "@/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("EmployeeLifecycleRepository", () => {
  test("loads only the latest non-void period revisions and revision guards", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status)
      VALUES (1, 'E001', 'Fixture User', 'active');
      INSERT INTO personnel_actions
        (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
         requested_by_employee_id, source_type, source_application_id, corrects_action_id,
         operation_id, payload_fingerprint, summary_json)
      VALUES
        ('action-1', 1, 'legacy_baseline', '2026-01-01', 1, NULL,
         NULL, 'migration', NULL, NULL, 'baseline-1',
         'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '{}'),
        ('action-2', 1, 'retired', '2026-06-30', 2, 1,
         1, 'direct', NULL, NULL, 'retire-1',
         'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '{}');
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at)
      VALUES
        ('employment-1', 1, 1, '2026-01-01', NULL, 0, 'action-1', 1),
        ('employment-1', 2, 1, '2026-01-01', '2026-07-01', 0, 'action-2', 2),
        ('void-employment', 1, 1, '2027-01-01', NULL, 0, 'action-1', 1),
        ('void-employment', 2, 1, '2027-01-01', NULL, 1, 'action-2', 2);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('status-1', 1, 'employment-1', 1, 'active', '2026-01-01',
              '2026-07-01', 0, 'action-1', 1);
      INSERT INTO employee_lifecycle_revisions (employee_id, revision, updated_at)
      VALUES (1, 4, 2);
      UPDATE organization_lifecycle_state SET revision = 7, updated_at = 2 WHERE id = 1;
    `)

    const repository = new EmployeeLifecycleRepository(context)
    const schedule = await repository.loadSchedule(1)
    const revisions = await repository.loadRevisions(1)

    expect(schedule).not.toBeInstanceOf(Error)
    expect((schedule as Exclude<typeof schedule, Error>).employments).toEqual([
      expect.objectContaining({ periodId: "employment-1", revision: 2, endsOn: "2026-07-01" }),
    ])
    expect(revisions).toEqual({ employeeRevision: 4, organizationRevision: 7 })
  })

  test("loads organization schedules in a bounded set of table queries", async () => {
    let queryCount = 0
    const setup = createTestContext()
    const countedContext = {
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
    await setup.db.exec(`
      INSERT INTO employees (id, code, name, status) VALUES
        (1, 'E001', 'Fixture One', 'active'),
        (2, 'E002', 'Fixture Two', 'active');
    `)

    const result = await new EmployeeLifecycleRepository(countedContext).loadOrganizationSchedules()

    expect(result).not.toBeInstanceOf(Error)
    expect(queryCount).toBeLessThanOrEqual(4)
  })
})
