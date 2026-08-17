import { restoreCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { ReadWorkforceState } from "@/contexts/company/application/workforce/read-workforce-state"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/workforce/organization-unit"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/workforce-id"
import { describe, expect, test } from "bun:test"

const employeeId = restoreWorkforceId("employee", "employee:1")
const employmentId = restoreWorkforceId("employment", "employment:1")

function organization(
  revisions: ReadonlyArray<number> = [0, 0],
  units: ReadonlyArray<OrganizationUnitPeriod> = [],
) {
  let revisionIndex = 0
  return {
    readSnapshot: async (asOf: ReturnType<typeof restoreCalendarDate>) => ({
      ok: true as const,
      snapshot: { revision: revisions[0] ?? 0, asOf, units },
    }),
    readRevision: async () => ({
      ok: true as const,
      revision: revisions[Math.min(revisionIndex++ + 1, revisions.length - 1)] ?? 0,
    }),
  }
}

function schedule(statusStartsOn = "2026-01-01"): WorkforceLifecycleSchedule {
  const common = {
    revision: 1,
    isVoid: false,
    recordedByActionId: restoreWorkforceId("personnel_action", "action:1"),
    recordedAt: 1,
    employeeId,
  }
  return {
    employeeId,
    employments: [
      {
        ...common,
        periodId: restoreWorkforceId("period", "employment-period:1"),
        employmentId,
        startsOn: restoreCalendarDate("2026-01-01"),
        endsOn: null,
      },
    ],
    statuses: [
      {
        ...common,
        periodId: restoreWorkforceId("period", "status-period:1"),
        employmentId,
        startsOn: restoreCalendarDate(statusStartsOn),
        endsOn: null,
        status: "ACTIVE",
      },
    ],
    assignments: [],
    responsibilities: [],
  }
}

describe("ReadWorkforceState", () => {
  test("returns the canonical state at a half-open business date", async () => {
    const result = await new ReadWorkforceState({
      workforce: { findByEmployeeId: async () => ({ ok: true, schedule: schedule() }) },
      organization: organization(),
    }).execute({ employeeId, asOf: restoreCalendarDate("2026-02-01") })

    expect(result.kind).toBe("found")
    if (result.kind === "found") {
      expect(result.state.status).toBe("ACTIVE")
      expect(result.state.employmentId).toBe(employmentId)
    }
  })

  test("distinguishes not found, invalid schedule, and unavailable storage", async () => {
    const notFound = await new ReadWorkforceState({
      workforce: { findByEmployeeId: async () => ({ ok: true, schedule: null }) },
      organization: organization(),
    }).execute({ employeeId, asOf: restoreCalendarDate("2026-02-01") })
    expect(notFound.kind).toBe("not_found")

    const invalid = await new ReadWorkforceState({
      workforce: {
        findByEmployeeId: async () => ({ ok: true, schedule: schedule("2026-03-01") }),
      },
      organization: organization(),
    }).execute({ employeeId, asOf: restoreCalendarDate("2026-02-01") })
    expect(invalid.kind).toBe("invalid_schedule")

    const cause = new Error("database unavailable")
    const unavailable = await new ReadWorkforceState({
      workforce: { findByEmployeeId: async () => ({ ok: false, cause }) },
      organization: organization(),
    }).execute({ employeeId, asOf: restoreCalendarDate("2026-02-01") })
    expect(unavailable).toEqual({ kind: "unavailable", cause })
  })

  test("fails closed when organization changes during the workforce read", async () => {
    const result = await new ReadWorkforceState({
      workforce: { findByEmployeeId: async () => ({ ok: true, schedule: schedule() }) },
      organization: organization([1, 2]),
    }).execute({ employeeId, asOf: restoreCalendarDate("2026-02-01") })

    expect(result.kind).toBe("unavailable")
    if (result.kind === "unavailable") {
      expect(result.cause).toEqual(expect.objectContaining({ code: "workforce_snapshot_changed" }))
    }
  })

  test("単一Employee readでは未取得の上長scheduleを欠損と推測しない", async () => {
    const organizationUnitId = restoreWorkforceId("organization_unit", "company")
    const unit: OrganizationUnitPeriod = {
      periodId: restoreWorkforceId("period", "organization-period:company"),
      revision: 1,
      organizationUnitId,
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
    const source = schedule()
    const withManager: WorkforceLifecycleSchedule = {
      ...source,
      assignments: [
        {
          ...source.employments[0]!,
          periodId: restoreWorkforceId("period", "assignment:1"),
          organizationUnitId,
          assignmentType: "PRIMARY",
          positionTitle: null,
          managerEmployeeId: restoreWorkforceId("employee", "employee:manager"),
        },
      ],
    }
    const result = await new ReadWorkforceState({
      workforce: { findByEmployeeId: async () => ({ ok: true, schedule: withManager }) },
      organization: organization([1, 1], [unit]),
    }).execute({ employeeId, asOf: restoreCalendarDate("2026-02-01") })

    expect(result.kind).toBe("found")
  })
})
