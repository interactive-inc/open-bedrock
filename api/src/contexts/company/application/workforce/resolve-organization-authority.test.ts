import { ResolveOrganizationAuthority } from "@/contexts/company/application/workforce/resolve-organization-authority"
import { restoreCalendarDate } from "@/contexts/company/domain/workforce/restore-calendar-date"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"
import type { WorkforceSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/restore-workforce-id"
import { describe, expect, test } from "bun:test"

const asOf = restoreCalendarDate("2026-06-01")
const unitId = restoreWorkforceId("organization_unit", "company")
const root: OrganizationUnitPeriod = {
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
  recordedByActionId: restoreWorkforceId("personnel_action", "action:organization"),
  recordedAt: 1,
}

function schedules(): ReadonlyArray<WorkforceSchedule> {
  const managerId = restoreWorkforceId("employee", "employee:manager")
  const memberId = restoreWorkforceId("employee", "employee:member")
  const value = (employeeId: typeof managerId, managerEmployeeId: typeof managerId | null) => {
    const suffix = employeeId.split(":").at(-1)!
    const employmentId = restoreWorkforceId("employment", `employment:${suffix}`)
    const common = {
      revision: 1,
      startsOn: restoreCalendarDate("2026-01-01"),
      endsOn: null,
      isVoid: false,
      recordedByActionId: restoreWorkforceId("personnel_action", `action:${suffix}`),
      recordedAt: 1,
      employeeId,
      employmentId,
    }
    return {
      employee: {
        id: employeeId,
        officialName: suffix,
        employeeCode: null,
        email: null,
        phone: null,
      },
      employments: [
        { ...common, periodId: restoreWorkforceId("period", `employment-period:${suffix}`) },
      ],
      statuses: [
        {
          ...common,
          periodId: restoreWorkforceId("period", `status-period:${suffix}`),
          status: "ACTIVE" as const,
        },
      ],
      assignments: [
        {
          ...common,
          periodId: restoreWorkforceId("period", `assignment:${suffix}`),
          organizationUnitId: unitId,
          assignmentType: "PRIMARY" as const,
          positionTitle: null,
          managerEmployeeId,
        },
      ],
      responsibilities:
        employeeId === managerId
          ? [
              {
                ...common,
                periodId: restoreWorkforceId("period", "responsibility:manager"),
                organizationUnitId: unitId,
                responsibilityType: "MANAGER" as const,
              },
            ]
          : [],
      accountLink: {
        accountId: restoreWorkforceId("system_account", `account:${suffix}`),
        employeeId,
      },
    } satisfies WorkforceSchedule
  }
  return [value(managerId, null), value(memberId, managerId)]
}

function service(revisions: readonly [number, number] = [3, 3]) {
  return new ResolveOrganizationAuthority({
    organization: {
      readSnapshot: async () => ({
        ok: true,
        snapshot: { revision: revisions[0], asOf, units: [root] },
      }),
      readRevision: async () => ({ ok: true, revision: revisions[1] }),
    },
    workforce: { readAllSnapshot: async () => ({ ok: true, schedules: schedules() }) },
  })
}

describe("ResolveOrganizationAuthority", () => {
  test("canonical Workforceから直属上司のSystem Account候補と根拠を解決する", async () => {
    const result = await service().execute({
      subjectEmployeeId: restoreWorkforceId("employee", "employee:member"),
      criteria: [{ kind: "direct_manager" }],
      asOf,
    })

    expect(result).toEqual({
      kind: "resolved",
      resolution: {
        snapshot: {
          schemaVersion: 1,
          source: "lifecycle",
          asOf,
          organizationRevision: 3,
        },
        candidates: [
          expect.objectContaining({
            employeeId: "employee:manager",
            accountId: "account:manager",
            qualification: expect.objectContaining({ criterionIndex: 0 }),
          }),
        ],
      },
    })
  })

  test("読み取り途中のorganization revision変更時は候補を返さない", async () => {
    const result = await service([3, 4]).execute({
      subjectEmployeeId: restoreWorkforceId("employee", "employee:member"),
      criteria: [{ kind: "direct_manager" }],
      asOf,
    })

    expect(result.kind).toBe("unavailable")
    if (result.kind === "unavailable") {
      expect(result.cause).toEqual(expect.objectContaining({ code: "workforce_snapshot_changed" }))
    }
  })
})
