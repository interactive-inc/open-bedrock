import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { EmployeeLifecycleWorkforceRepository } from "@/contexts/company/infrastructure/workforce/employee-lifecycle-workforce.repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { describe, expect, test } from "bun:test"

describe("EmployeeLifecycleWorkforceRepository", () => {
  test("projects the requested D1 lifecycle schedule through the common read port", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status)
      VALUES (1, 'E001', 'Fixture User', 'active');
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at)
      VALUES ('employment-1', 1, 1, '2026-01-01', NULL, 0, 'action-1', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('status-1', 1, 'employment-1', 1, 'active', '2026-01-01',
              NULL, 0, 'action-1', 1);
    `)

    const result = await new EmployeeLifecycleWorkforceRepository(context).findByEmployeeId(
      toWorkforceEmployeeId(1),
    )

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        schedule: expect.objectContaining({
          employeeId: "employee:1",
          employments: [expect.objectContaining({ employmentId: "employment:employment-1" })],
          statuses: [expect.objectContaining({ status: "ACTIVE" })],
        }),
      }),
    )
  })

  test("distinguishes an absent employee from an employee without lifecycle periods", async () => {
    const { context, db } = createTestContext()
    await db.exec(`
      INSERT INTO employees (id, code, name, status)
      VALUES (1, 'E001', 'Fixture User', 'active');
    `)
    const repository = new EmployeeLifecycleWorkforceRepository(context)
    const existingEmployeeId = toWorkforceEmployeeId(1)

    expect(await repository.findByEmployeeId(toWorkforceEmployeeId(2))).toEqual({
      ok: true,
      schedule: null,
    })
    expect(await repository.findByEmployeeId(existingEmployeeId)).toEqual({
      ok: true,
      schedule: {
        employeeId: existingEmployeeId,
        employments: [],
        statuses: [],
        assignments: [],
        responsibilities: [],
      },
    })
  })
})
