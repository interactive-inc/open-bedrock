import {
  projectPersonnelAction,
  type PersonnelActionProjection,
} from "@/contexts/company/domain/employee-lifecycle/project-personnel-action"
import type {
  EmployeeStatusPeriod,
  EmploymentPeriod,
  LifecycleSchedule,
  OrgAssignmentPeriod,
} from "@/contexts/company/domain/employee-lifecycle/lifecycle-schedule"
import { ApplicationError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

const emptySchedule = (): LifecycleSchedule => ({
  employments: [],
  statuses: [],
  assignments: [],
  responsibilities: [],
})

const actionIds = {
  hire: "00000000-0000-4000-8000-000000000001",
  change: "00000000-0000-4000-8000-000000000002",
  next: "00000000-0000-4000-8000-000000000003",
  correction: "00000000-0000-4000-8000-000000000004",
}

const baseReferences = {
  departments: [
    { code: "D001", name: "Product", archived: false },
    { code: "D002", name: "Sales", archived: false },
  ],
  employees: [
    { id: 1, code: "E001" },
    { id: 2, code: "E002" },
  ],
}

function run(
  schedule: LifecycleSchedule,
  input: Parameters<typeof projectPersonnelAction>[0]["command"]["input"],
  options: Partial<Parameters<typeof projectPersonnelAction>[0]> = {},
): PersonnelActionProjection | ApplicationError {
  return projectPersonnelAction({
    schedule,
    organizationSchedules: [schedule],
    command: {
      actionId: `${input.kind}:${"eventOn" in input ? input.eventOn : input.retirementOn}`,
      employeeId: 1,
      recordedAt: 1,
      input,
    },
    ...baseReferences,
    ...options,
  })
}

function projection(
  result: PersonnelActionProjection | ApplicationError,
): PersonnelActionProjection {
  expect(result).not.toBeInstanceOf(ApplicationError)
  return result as PersonnelActionProjection
}

function expectCode(result: PersonnelActionProjection | ApplicationError, code: string): void {
  expect(result).toBeInstanceOf(ApplicationError)
  expect((result as ApplicationError).code).toBe(code)
}

function hiredSchedule(): LifecycleSchedule {
  return projection(
    projectPersonnelAction({
      schedule: emptySchedule(),
      organizationSchedules: [],
      command: {
        actionId: actionIds.hire,
        employeeId: 1,
        recordedAt: 1,
        input: {
          kind: "hire",
          employeeCode: "E001",
          employeeName: "Fixture User",
          eventOn: "2026-04-01",
          departmentCode: "D001",
          positionTitle: "Member",
          managerEmployeeCode: null,
        },
      },
      ...baseReferences,
    }),
  ).schedule
}

describe("projectPersonnelAction", () => {
  test("projects hire into employment, active status, and an optional primary assignment", () => {
    const result = projection(
      projectPersonnelAction({
        schedule: emptySchedule(),
        organizationSchedules: [],
        command: {
          actionId: actionIds.hire,
          employeeId: 1,
          recordedAt: 1,
          input: {
            kind: "hire",
            employeeCode: "E001",
            employeeName: "Fixture User",
            eventOn: "2026-04-01",
            departmentCode: "D001",
            positionTitle: "Member",
            managerEmployeeCode: null,
          },
        },
        ...baseReferences,
      }),
    )

    expect(result.schedule.employments).toHaveLength(1)
    expect(result.schedule.statuses).toEqual([
      expect.objectContaining({ status: "active", startsOn: "2026-04-01", endsOn: null }),
    ])
    expect(result.schedule.assignments).toEqual([
      expect.objectContaining({
        assignmentType: "primary",
        departmentCode: "D001",
        positionTitle: "Member",
      }),
    ])
    expect(result.mutations).toHaveLength(3)
    expect(result.affectsOrganization).toBe(true)
    expect(result.summary).toEqual({
      kind: "hire",
      eventOn: "2026-04-01",
      department: { code: "D001", name: "Product" },
      positionTitle: "Member",
      managerEmployeeCode: null,
      status: "active",
    })
    expect(JSON.stringify(result.summary)).not.toContain("Fixture User")
  })

  test("splits status periods for leave and return, then closes every open period after retirement day", () => {
    const leave = projection(
      run(hiredSchedule(), { kind: "leave_started", employeeCode: "E001", eventOn: "2026-06-01" }),
    )
    expect(
      leave.schedule.statuses.map(({ status, startsOn, endsOn }) => ({ status, startsOn, endsOn })),
    ).toEqual([
      { status: "active", startsOn: "2026-04-01", endsOn: "2026-06-01" },
      { status: "leave", startsOn: "2026-06-01", endsOn: null },
    ])

    const returned = projection(
      run(leave.schedule, { kind: "returned", employeeCode: "E001", eventOn: "2026-07-01" }),
    )
    const retired = projection(
      run(returned.schedule, {
        kind: "retired",
        employeeCode: "E001",
        retirementOn: "2026-07-31",
      }),
    )

    expect(retired.schedule.employments[0]?.endsOn).toBe("2026-08-01")
    expect(retired.schedule.statuses.at(-1)?.endsOn).toBe("2026-08-01")
    expect(retired.schedule.assignments[0]?.endsOn).toBe("2026-08-01")
    expect(retired.summary).toEqual({
      kind: "retired",
      eventOn: "2026-07-31",
      status: "retired",
    })
  })

  test("supports rehire after retirement without overlapping the prior employment", () => {
    const retired = projection(
      run(hiredSchedule(), {
        kind: "retired",
        employeeCode: "E001",
        retirementOn: "2026-04-30",
      }),
    )
    const rehired = projection(
      run(retired.schedule, {
        kind: "rehire",
        employeeCode: "E001",
        eventOn: "2026-06-01",
        departmentCode: "D002",
        positionTitle: "Lead",
        managerEmployeeCode: null,
      }),
    )

    expect(rehired.schedule.employments).toHaveLength(2)
    expect(
      rehired.schedule.employments.map(({ startsOn, endsOn }) => ({ startsOn, endsOn })),
    ).toEqual([
      { startsOn: "2026-04-01", endsOn: "2026-05-01" },
      { startsOn: "2026-06-01", endsOn: null },
    ])
  })

  test("projects transfer, concurrent assignment, position category, and manager changes", () => {
    const managerSchedule = hiredManagerSchedule()
    const transferred = projection(
      run(
        hiredSchedule(),
        {
          kind: "transferred",
          employeeCode: "E001",
          eventOn: "2026-06-01",
          departmentCode: "D002",
          positionTitle: "Lead",
          managerEmployeeCode: "E002",
        },
        { organizationSchedules: [hiredSchedule(), managerSchedule] },
      ),
    )
    const concurrent = projection(
      run(
        transferred.schedule,
        {
          kind: "concurrent_assignment_started",
          employeeCode: "E001",
          eventOn: "2026-06-15",
          departmentCode: "D001",
          positionTitle: "Advisor",
          managerEmployeeCode: null,
        },
        { organizationSchedules: [transferred.schedule, managerSchedule] },
      ),
    )
    const promoted = projection(
      run(
        concurrent.schedule,
        {
          kind: "position_changed",
          employeeCode: "E001",
          eventOn: "2026-07-01",
          departmentCode: "D002",
          assignmentType: "primary",
          positionTitle: "Director",
          changeType: "promotion",
        },
        { organizationSchedules: [concurrent.schedule, managerSchedule] },
      ),
    )
    const managerChanged = projection(
      run(
        promoted.schedule,
        {
          kind: "manager_changed",
          employeeCode: "E001",
          eventOn: "2026-08-01",
          departmentCode: "D002",
          assignmentType: "primary",
          managerEmployeeCode: null,
        },
        { organizationSchedules: [promoted.schedule, managerSchedule] },
      ),
    )

    expect(
      managerChanged.schedule.assignments.filter((item) => item.assignmentType === "concurrent"),
    ).toHaveLength(1)
    expect(managerChanged.schedule.assignments.at(-1)).toEqual(
      expect.objectContaining({
        departmentCode: "D002",
        positionTitle: "Director",
        managerEmployeeId: null,
      }),
    )
    expect(promoted.summary).toEqual(
      expect.objectContaining({ kind: "position_changed", changeType: "promotion" }),
    )
  })

  test("starts and ends department responsibility only while assigned", () => {
    const started = projection(
      run(hiredSchedule(), {
        kind: "department_responsibility_started",
        employeeCode: "E001",
        eventOn: "2026-06-01",
        departmentCode: "D001",
      }),
    )
    const ended = projection(
      run(started.schedule, {
        kind: "department_responsibility_ended",
        employeeCode: "E001",
        eventOn: "2026-07-01",
        departmentCode: "D001",
      }),
    )

    expect(ended.schedule.responsibilities).toEqual([
      expect.objectContaining({ startsOn: "2026-06-01", endsOn: "2026-07-01" }),
    ])
    expect(started.affectsOrganization).toBe(true)
  })

  test("corrects an action by appending reversal revisions before applying the replacement", () => {
    const original = projection(
      projectPersonnelAction({
        schedule: emptySchedule(),
        organizationSchedules: [],
        command: {
          actionId: actionIds.hire,
          employeeId: 1,
          recordedAt: 1,
          input: {
            kind: "hire",
            employeeCode: "E001",
            employeeName: "Fixture User",
            eventOn: "2026-04-01",
            departmentCode: "D001",
            positionTitle: "Member",
            managerEmployeeCode: null,
          },
        },
        ...baseReferences,
      }),
    )
    const corrected = projection(
      projectPersonnelAction({
        schedule: original.schedule,
        organizationSchedules: [original.schedule],
        command: {
          actionId: actionIds.correction,
          employeeId: 1,
          recordedAt: 2,
          input: {
            kind: "corrected",
            eventOn: "2026-04-02",
            correctsActionId: actionIds.hire,
            reason: "Wrong department",
            replacementAction: {
              kind: "hire",
              employeeCode: "E001",
              employeeName: "Fixture User",
              eventOn: "2026-04-01",
              departmentCode: "D002",
              positionTitle: "Member",
              managerEmployeeCode: null,
            },
          },
          correction: { mutations: original.mutations, alreadyCorrected: false },
        },
        ...baseReferences,
      }),
    )

    expect(corrected.schedule.assignments).toEqual([
      expect.objectContaining({ departmentCode: "D002" }),
    ])
    expect(corrected.mutations.some((mutation) => mutation.after.isVoid)).toBe(true)
    expect(JSON.stringify(corrected.summary)).not.toContain("Wrong department")
    expect(corrected.summary).toEqual({
      kind: "corrected",
      eventOn: "2026-04-02",
      correctsActionId: actionIds.hire,
      replacementKind: "hire",
    })
  })

  test("rejects correction branching, invalid transitions, and archived target departments", () => {
    expectCode(
      projectPersonnelAction({
        schedule: hiredSchedule(),
        organizationSchedules: [hiredSchedule()],
        command: {
          actionId: actionIds.correction,
          employeeId: 1,
          recordedAt: 2,
          input: {
            kind: "corrected",
            eventOn: "2026-04-02",
            correctsActionId: actionIds.hire,
            reason: "Correction",
            replacementAction: {
              kind: "returned",
              employeeCode: "E001",
              eventOn: "2026-04-01",
            },
          },
          correction: { mutations: [], alreadyCorrected: true },
        },
        ...baseReferences,
      }),
      "personnel_action_already_corrected",
    )
    expectCode(
      run(hiredSchedule(), { kind: "returned", employeeCode: "E001", eventOn: "2026-05-01" }),
      "personnel_action_invalid_transition",
    )
    expectCode(
      run(
        hiredSchedule(),
        {
          kind: "transferred",
          employeeCode: "E001",
          eventOn: "2026-06-01",
          departmentCode: "D002",
          positionTitle: null,
          managerEmployeeCode: null,
        },
        {
          departments: [
            { code: "D001", name: "Product", archived: false },
            { code: "D002", name: "Sales", archived: true },
          ],
        },
      ),
      "department_not_active",
    )
  })
})

function hiredManagerSchedule(): LifecycleSchedule {
  const employment: EmploymentPeriod = {
    periodId: "manager-employment",
    revision: 1,
    employeeId: 2,
    startsOn: "2026-01-01",
    endsOn: null,
    isVoid: false,
    recordedByActionId: "manager-action",
    recordedAt: 1,
  }
  const status: EmployeeStatusPeriod = {
    ...employment,
    periodId: "manager-status",
    employmentPeriodId: employment.periodId,
    status: "active",
  }
  const assignment: OrgAssignmentPeriod = {
    ...employment,
    periodId: "manager-assignment",
    employmentPeriodId: employment.periodId,
    departmentCode: "D002",
    assignmentType: "primary",
    positionTitle: "Manager",
    managerEmployeeId: null,
  }

  return {
    employments: [employment],
    statuses: [status],
    assignments: [assignment],
    responsibilities: [],
  }
}
