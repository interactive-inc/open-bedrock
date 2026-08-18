import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import type {
  EmploymentPeriod,
  EmploymentStatusPeriod,
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
  WorkforceLifecycleSchedule,
  WorkforceSchedule,
} from "@/contexts/company/domain/workforce/workforce-schedule"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"
import { validateWorkforceLifecycleSchedules } from "@/contexts/company/domain/workforce/validate-workforce-lifecycle-schedules"
import { validateWorkforceSchedules } from "@/contexts/company/domain/workforce/validate-workforce-schedules"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"
import { describe, expect, test } from "bun:test"

const managerId = restoreWorkforceId("employee", "employee-manager")
const memberId = restoreWorkforceId("employee", "employee-member")
const rootUnitId = restoreWorkforceId("organization_unit", "unit-root")
const branchUnitId = restoreWorkforceId("organization_unit", "unit-branch")

function period(periodId: string, startsOn = "2026-01-01", endsOn: string | null = null) {
  return {
    periodId: restoreWorkforceId("period", periodId),
    revision: 1,
    startsOn: restoreCalendarDate(startsOn),
    endsOn: endsOn === null ? null : restoreCalendarDate(endsOn),
    isVoid: false,
    recordedByActionId: restoreWorkforceId("personnel_action", "action-fixture"),
    recordedAt: 1,
  }
}

function employment(employeeId: typeof managerId, suffix: string): EmploymentPeriod {
  return {
    ...period(`employment-period-${suffix}`),
    employmentId: restoreWorkforceId("employment", `employment-${suffix}`),
    employeeId,
  }
}

function status(employmentPeriod: EmploymentPeriod, suffix: string): EmploymentStatusPeriod {
  return {
    ...period(`status-period-${suffix}`),
    employmentId: employmentPeriod.employmentId,
    employeeId: employmentPeriod.employeeId,
    status: "ACTIVE",
  }
}

function assignment(
  employmentPeriod: EmploymentPeriod,
  suffix: string,
  managerEmployeeId: typeof managerId | null,
): OrgAssignmentPeriod {
  return {
    ...period(`assignment-period-${suffix}`),
    employmentId: employmentPeriod.employmentId,
    employeeId: employmentPeriod.employeeId,
    organizationUnitId: rootUnitId,
    assignmentType: "PRIMARY",
    positionTitle: null,
    managerEmployeeId,
  }
}

function responsibility(employmentPeriod: EmploymentPeriod): OrgResponsibilityPeriod {
  return {
    ...period("responsibility-period-manager"),
    employmentId: employmentPeriod.employmentId,
    employeeId: employmentPeriod.employeeId,
    organizationUnitId: rootUnitId,
    responsibilityType: "MANAGER",
  }
}

function organizationUnitPeriods(): ReadonlyArray<OrganizationUnitPeriod> {
  return [
    {
      ...period("organization-period-root"),
      organizationUnitId: rootUnitId,
      code: "ROOT",
      officialName: "Company",
      kind: "COMPANY",
      parentOrganizationUnitId: null,
    },
    {
      ...period("organization-period-branch"),
      organizationUnitId: branchUnitId,
      code: "BRANCH",
      officialName: "Branch",
      kind: "DEPARTMENT",
      parentOrganizationUnitId: rootUnitId,
    },
  ]
}

function fixture(): [WorkforceSchedule, WorkforceSchedule] {
  const managerEmployment = employment(managerId, "manager")
  const memberEmployment = employment(memberId, "member")
  return [
    {
      employee: {
        id: managerId,
        officialName: "Manager Example",
        employeeCode: "M001",
        email: null,
        phone: null,
      },
      employments: [managerEmployment],
      statuses: [status(managerEmployment, "manager")],
      assignments: [assignment(managerEmployment, "manager", null)],
      responsibilities: [responsibility(managerEmployment)],
      accountLink: {
        accountId: restoreWorkforceId("system_account", "account-manager"),
        employeeId: managerId,
      },
    },
    {
      employee: {
        id: memberId,
        officialName: "Member Example",
        employeeCode: null,
        email: null,
        phone: null,
      },
      employments: [memberEmployment],
      statuses: [status(memberEmployment, "member")],
      assignments: [assignment(memberEmployment, "member", managerId)],
      responsibilities: [],
      accountLink: {
        accountId: restoreWorkforceId("system_account", "account-member"),
        employeeId: memberId,
      },
    },
  ]
}

function validate(schedules: ReadonlyArray<WorkforceSchedule>) {
  return validateWorkforceSchedules({
    schedules,
    organizationUnitPeriods: organizationUnitPeriods(),
  })
}

function lifecycle(schedule: WorkforceSchedule): WorkforceLifecycleSchedule {
  return {
    employeeId: schedule.employee.id,
    employments: schedule.employments,
    statuses: schedule.statuses,
    assignments: schedule.assignments,
    responsibilities: schedule.responsibilities,
  }
}

describe("validateWorkforceSchedules", () => {
  test("accepts a contiguous, revisioned workforce schedule", () => {
    expect(validate(fixture())).toBeNull()
  })

  test("validates lifecycle schedules without Employee profile or System Account", () => {
    const schedules = fixture().map(lifecycle)
    expect(
      validateWorkforceLifecycleSchedules({
        schedules,
        organizationUnitPeriods: organizationUnitPeriods(),
      }),
    ).toBeNull()
  })

  test("rejects a status gap", () => {
    const [manager, member] = fixture()
    const brokenMember = {
      ...member,
      statuses: [{ ...member.statuses[0]!, endsOn: restoreCalendarDate("2026-06-01") }],
    }
    expect(validate([manager, brokenMember])).toEqual(
      expect.objectContaining({ code: "status_gap_or_overlap" }),
    )
  })

  test("rejects overlapping primary assignments", () => {
    const [manager, member] = fixture()
    const duplicate = {
      ...member.assignments[0]!,
      periodId: restoreWorkforceId("period", "assignment-period-member-2"),
      organizationUnitId: branchUnitId,
    }
    expect(
      validate([manager, { ...member, assignments: [...member.assignments, duplicate] }]),
    ).toEqual(expect.objectContaining({ code: "primary_assignment_overlap" }))
  })

  test("rejects a manager cycle", () => {
    const [manager, member] = fixture()
    const managerAssignment = { ...manager.assignments[0]!, managerEmployeeId: memberId }
    expect(validate([{ ...manager, assignments: [managerAssignment] }, member])).toEqual(
      expect.objectContaining({ code: "manager_cycle" }),
    )
  })

  test("rejects an inactive manager", () => {
    const [manager, member] = fixture()
    const prehire = { ...manager.statuses[0]!, status: "PRE_HIRE" as const }
    expect(validate([{ ...manager, statuses: [prehire] }, member])).toEqual(
      expect.objectContaining({ code: "manager_not_active" }),
    )
  })

  test("rejects a responsibility without an assignment", () => {
    const [manager, member] = fixture()
    expect(validate([{ ...manager, assignments: [] }, member])).toEqual(
      expect.objectContaining({ code: "responsibility_without_assignment" }),
    )
  })

  test("rejects a responsibility with a non-canonical code", () => {
    const [manager, member] = fixture()
    const invalid = { ...manager.responsibilities[0]!, responsibilityType: "people ops" }
    expect(validate([{ ...manager, responsibilities: [invalid] }, member])).toEqual(
      expect.objectContaining({ code: "invalid_responsibility" }),
    )
  })

  test("rejects duplicate System Account links", () => {
    const [manager, member] = fixture()
    expect(validate([manager, { ...member, accountLink: manager.accountLink }])).toEqual(
      expect.objectContaining({ code: "duplicate_account_link" }),
    )
  })
})
