import { restoreCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import { ReadWorkforceState } from "@/contexts/company/application/workforce/read-workforce-state"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/workforce-id"
import { describe, expect, test } from "bun:test"

const employeeId = restoreWorkforceId("employee", "employee:1")
const employmentId = restoreWorkforceId("employment", "employment:1")

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
      findByEmployeeId: async () => ({ ok: true, schedule: schedule() }),
    }).execute({ employeeId, asOf: restoreCalendarDate("2026-02-01") })

    expect(result.kind).toBe("found")
    if (result.kind === "found") {
      expect(result.state.status).toBe("ACTIVE")
      expect(result.state.employmentId).toBe(employmentId)
    }
  })

  test("distinguishes not found, invalid schedule, and unavailable storage", async () => {
    const notFound = await new ReadWorkforceState({
      findByEmployeeId: async () => ({ ok: true, schedule: null }),
    }).execute({ employeeId, asOf: restoreCalendarDate("2026-02-01") })
    expect(notFound.kind).toBe("not_found")

    const invalid = await new ReadWorkforceState({
      findByEmployeeId: async () => ({ ok: true, schedule: schedule("2026-03-01") }),
    }).execute({ employeeId, asOf: restoreCalendarDate("2026-02-01") })
    expect(invalid.kind).toBe("invalid_schedule")

    const cause = new Error("database unavailable")
    const unavailable = await new ReadWorkforceState({
      findByEmployeeId: async () => ({ ok: false, cause }),
    }).execute({ employeeId, asOf: restoreCalendarDate("2026-02-01") })
    expect(unavailable).toEqual({ kind: "unavailable", cause })
  })
})
