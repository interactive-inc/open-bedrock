import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { DirectPersonnelActionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/direct-personnel-action.adapter"
import { EmployeeLifecycleAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle.adapter"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import type { LeaveType } from "@/contexts/leave/domain/definitions/leave-request.definition"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/repositories/leave-request.repository"
import { createTestContext } from "@tests/api/support/create-test-context"
import { initializeCompanyTestFixture } from "@tests/api/support/initialize-company-test-fixture"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"

export async function createLeaveDecisionTestContext(leaveType: LeaveType = "annual") {
  const f = await createTestContext()
  const organization = async (
    status: "active" | "leave" | "retired" = "active",
    manager = true,
  ) => {
    await initializeCompanyTestFixture({
      db: f.db,
      employees: [
        { id: 2, code: "E002", name: "Manager", deptId: 3, status },
        { id: 5, code: "E005", name: "Member", deptId: 3, status: "active" },
      ],
      departments: [
        { id: 3, code: "D003", name: "Team", managerEmployeeCode: manager ? "E002" : null },
      ],
      memberships: [
        { departmentCode: "D003", employeeCode: "E002", managerEmployeeCode: null },
        {
          departmentCode: "D003",
          employeeCode: "E005",
          managerEmployeeCode: manager ? "E002" : null,
        },
      ],
    })
  }
  await seedIamForEmployees(f.db, [
    { id: 1, email: "you+admin@example.com", passwordHash: "unused", role: "root" },
    { id: 2, email: "you+manager@example.com", passwordHash: "unused", role: "manager" },
    { id: 5, email: "you+member@example.com", passwordHash: "unused", role: "member" },
  ])
  await organization()
  const context = { ...f.context, env: { ...f.context.env, NOW: "2026-06-15T00:00:00.000Z" } }
  const personnel = async (input: PersonnelActionInput, employee = 2) => {
    const employeeId = toWorkforceEmployeeId(employee)
    const revisions = await new EmployeeLifecycleAdapter(context).loadRevisions(employeeId)
    if (revisions instanceof Error) throw revisions
    const applied = await new DirectPersonnelActionAdapter(context).apply({
      session: makeTestSession("root", 1),
      employeeId,
      idempotencyKey: crypto.randomUUID(),
      expectedEmployeeRevision: revisions.employeeRevision,
      expectedOrganizationRevision: revisions.organizationRevision,
      input,
    })
    if (applied instanceof Error) throw applied
  }
  const changeManager = async (status: "leave" | "retired" | "active") => {
    if (status === "leave") {
      await personnel({
        kind: "leave_started",
        employeeCode: "E002",
        eventOn: restoreCalendarDate("2026-06-01"),
      })
      return
    }
    await personnel(
      {
        kind: "manager_changed",
        employeeCode: "E005",
        eventOn: restoreCalendarDate("2026-06-01"),
        departmentCode: "D003",
        assignmentType: "primary",
        managerEmployeeCode: null,
      },
      5,
    )
    await personnel({
      kind: "department_responsibility_ended",
      employeeCode: "E002",
      eventOn: restoreCalendarDate("2026-06-01"),
      departmentCode: "D003",
    })
    if (status === "retired")
      await personnel({
        kind: "retired",
        employeeCode: "E002",
        retirementOn: restoreCalendarDate("2026-06-01"),
      })
  }
  const repository = new LeaveRequestRepository(context)
  const request = await repository.create(
    LeaveRequest.create({
      employeeId: toWorkforceEmployeeId(5),
      leaveType,
      startDate: "2026-06-20",
      endDate: "2026-06-22",
      days: 3,
      unit: "full_day",
      hours: null,
      consumedDays: 3,
      reason: "Personal time",
      createdAt: "2026-06-01T00:00:00.000Z",
    }),
  )
  if (request instanceof Error || request?.id === null || request === null)
    throw new Error("request missing")
  await f.db
    .prepare(`INSERT INTO leave_balances
    (employee_id, fiscal_year, leave_type, granted_days, used_days, remaining_days)
    VALUES ('5', '2026', ?1, 20, 0, 20)`)
    .bind(leaveType)
    .run()
  const command = {
    session: makeTestSession("manager", 2),
    tokenVersion: 0,
    leaveRequestId: request.id,
    approverId: toWorkforceEmployeeId(2),
    comment: "Confirmed coverage",
    createdAt: context.env.NOW,
  }
  const persisted = () =>
    f.db
      .prepare(`SELECT
    (SELECT status FROM leave_requests WHERE id = ?1) AS status,
    (SELECT used_days FROM leave_balances WHERE employee_id = '5' AND leave_type = ?2) AS used,
    (SELECT count(*) FROM system_audit_events WHERE action LIKE 'leave.request.%') AS audits`)
      .bind(request.id, leaveType)
      .first<{ status: string; used: number; audits: number }>()
  return { ...f, context, repository, request, command, persisted, changeManager }
}
