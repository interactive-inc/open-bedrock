import { ApplyOrganizationChange } from "@/contexts/company/application/workforce/apply-organization-change"
import type { OrganizationChangeSet } from "@/contexts/company/application/workforce/organization-change"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"
import type {
  OrgAssignmentPeriod,
  WorkforceSchedule,
} from "@/contexts/company/domain/workforce/workforce-schedule"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"
import { describe, expect, test } from "bun:test"

const asOf = restoreCalendarDate("2026-06-01")
const operationId = restoreWorkforceId("personnel_action", "action:change")
const unitId = restoreWorkforceId("organization_unit", "company")

function unitPeriod(overrides: Partial<OrganizationUnitPeriod> = {}): OrganizationUnitPeriod {
  return {
    periodId: restoreWorkforceId("period", "period:company"),
    revision: 1,
    organizationUnitId: unitId,
    code: "ROOT",
    officialName: "Company",
    kind: "COMPANY",
    parentOrganizationUnitId: null,
    startsOn: restoreCalendarDate("2026-01-01"),
    endsOn: null,
    isVoid: false,
    recordedByActionId: operationId,
    recordedAt: 10,
    ...overrides,
  }
}

function schedule(id: string): WorkforceSchedule {
  const employeeId = restoreWorkforceId("employee", `employee:${id}`)
  const employmentId = restoreWorkforceId("employment", `employment:${id}`)
  const common = {
    revision: 1,
    isVoid: false,
    recordedByActionId: restoreWorkforceId("personnel_action", `action:employment:${id}`),
    recordedAt: 1,
    employmentId,
    employeeId,
    startsOn: restoreCalendarDate("2026-01-01"),
    endsOn: null,
  }
  return {
    employee: {
      id: employeeId,
      officialName: id,
      employeeCode: null,
      email: null,
      phone: null,
    },
    employments: [{ ...common, periodId: restoreWorkforceId("period", `employment-period:${id}`) }],
    statuses: [
      {
        ...common,
        periodId: restoreWorkforceId("period", `status-period:${id}`),
        status: "ACTIVE",
      },
    ],
    assignments: [],
    responsibilities: [],
    accountLink: null,
  }
}

function assignment(employee: WorkforceSchedule, manager: WorkforceSchedule): OrgAssignmentPeriod {
  return {
    periodId: restoreWorkforceId("period", `assignment:${employee.employee.id}`),
    revision: 1,
    employmentId: employee.employments[0]!.employmentId,
    employeeId: employee.employee.id,
    organizationUnitId: unitId,
    assignmentType: "PRIMARY",
    positionTitle: null,
    managerEmployeeId: manager.employee.id,
    startsOn: restoreCalendarDate("2026-01-01"),
    endsOn: null,
    isVoid: false,
    recordedByActionId: operationId,
    recordedAt: 10,
  }
}

function change(overrides: Partial<OrganizationChangeSet> = {}): OrganizationChangeSet {
  return {
    operationId,
    expectedRevision: 0,
    asOf,
    recordedAt: 10,
    actorAccountId: "account:1",
    reason: "Create organization unit",
    evidenceReferences: [],
    organizationUnits: [{ id: unitId, createdAt: 10 }],
    unitPeriods: [unitPeriod()],
    assignments: [],
    responsibilities: [],
    ...overrides,
  }
}

function service(
  props: Readonly<{
    revision?: number
    units?: ReadonlyArray<OrganizationUnitPeriod>
    schedules?: ReadonlyArray<WorkforceSchedule>
  }> = {},
) {
  const writes: OrganizationChangeSet[] = []
  const revision = props.revision ?? 0
  return {
    writes,
    value: new ApplyOrganizationChange({
      organization: {
        readSnapshot: async () => ({
          ok: true,
          snapshot: { revision, asOf, units: props.units ?? [] },
        }),
        readRevision: async () => ({ ok: true, revision }),
      },
      workforce: {
        readAllSnapshot: async () => ({ ok: true, schedules: props.schedules ?? [] }),
      },
      writer: {
        findReplay: async () => ({ ok: true, kind: "not_found" }),
        append: async (input) => {
          writes.push(input)
          return {
            ok: true,
            revision:
              input.expectedRevision +
              input.unitPeriods.length +
              input.assignments.length +
              input.responsibilities.length,
            replayed: false,
          }
        },
      },
    }),
  }
}

describe("ApplyOrganizationChange", () => {
  test("検証済みOrgUnit作成をexpected revision付きwriterへ一度だけ渡す", async () => {
    const target = service()
    expect(await target.value.execute(change())).toEqual({
      kind: "applied",
      revision: 1,
      replayed: false,
    })
    expect(target.writes).toHaveLength(1)
  })

  test("stale revisionは書かずにconflictとして返す", async () => {
    const target = service({ revision: 2 })
    expect(await target.value.execute(change({ expectedRevision: 1 }))).toEqual({
      kind: "conflict",
      actualRevision: 2,
    })
    expect(target.writes).toEqual([])
  })

  test("親なし子OrgUnitとrevision飛ばしをapplication境界で拒否する", async () => {
    const childId = restoreWorkforceId("organization_unit", "child")
    const target = service()
    const invalidParent = unitPeriod({
      organizationUnitId: childId,
      kind: "DEPARTMENT",
      code: "CHILD",
      officialName: "Child",
    })
    expect(
      await target.value.execute(
        change({
          organizationUnits: [{ id: childId, createdAt: 10 }],
          unitPeriods: [invalidParent],
        }),
      ),
    ).toEqual(expect.objectContaining({ kind: "invalid" }))

    expect(
      await target.value.execute(change({ unitPeriods: [unitPeriod({ revision: 2 })] })),
    ).toEqual(expect.objectContaining({ kind: "invalid" }))
    expect(target.writes).toEqual([])
  })

  test("同じ原子変更で作る循環上長関係を拒否する", async () => {
    const manager = schedule("manager")
    const member = schedule("member")
    const target = service({ schedules: [manager, member] })
    const managerAssignment = assignment(manager, member)
    const memberAssignment = assignment(member, manager)

    expect(
      await target.value.execute(change({ assignments: [managerAssignment, memberAssignment] })),
    ).toEqual(
      expect.objectContaining({
        kind: "invalid",
        error: expect.objectContaining({ code: "invalid_workforce" }),
      }),
    )
    expect(target.writes).toEqual([])
  })

  test("同じperiodの連続revisionを一つの原子変更として検証する", async () => {
    const target = service()
    const first = unitPeriod({ endsOn: restoreCalendarDate("2026-04-01") })
    const corrected = unitPeriod({ revision: 2, officialName: "Canonical Company" })

    expect(await target.value.execute(change({ unitPeriods: [first, corrected] }))).toEqual({
      kind: "applied",
      revision: 2,
      replayed: false,
    })
    expect(target.writes).toHaveLength(1)
  })
})
