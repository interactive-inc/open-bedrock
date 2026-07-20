import { applyLifecycleMutations } from "@/domain/employee-lifecycle/apply-lifecycle-mutations"
import { containsDate } from "@/domain/employee-lifecycle/contains-date"
import type {
  EmploymentPeriod,
  LifecycleSchedule,
} from "@/domain/employee-lifecycle/lifecycle-schedule"
import { normalizeLifecycleSchedule } from "@/domain/employee-lifecycle/normalize-lifecycle-schedule"
import { periodsOverlap } from "@/domain/employee-lifecycle/periods-overlap"
import { describe, expect, test } from "bun:test"

const employment = (overrides: Partial<EmploymentPeriod> = {}): EmploymentPeriod => ({
  periodId: "employment-1",
  revision: 1,
  employeeId: 1,
  startsOn: "2026-04-01",
  endsOn: null,
  isVoid: false,
  recordedByActionId: "action-1",
  recordedAt: 1,
  ...overrides,
})

const emptySchedule = (): LifecycleSchedule => ({
  employments: [],
  statuses: [],
  assignments: [],
  responsibilities: [],
})

describe("lifecycle schedule", () => {
  test("uses half-open periods at past, current, and future boundaries", () => {
    const period = employment({ endsOn: "2026-05-01" })

    expect(containsDate(period, "2026-03-31")).toBe(false)
    expect(containsDate(period, "2026-04-01")).toBe(true)
    expect(containsDate(period, "2026-04-30")).toBe(true)
    expect(containsDate(period, "2026-05-01")).toBe(false)
  })

  test("detects overlap without treating a shared boundary as overlap", () => {
    expect(
      periodsOverlap(
        employment({ endsOn: "2026-05-01" }),
        employment({ periodId: "employment-2", startsOn: "2026-05-01" }),
      ),
    ).toBe(false)
    expect(
      periodsOverlap(
        employment({ endsOn: "2026-05-02" }),
        employment({ periodId: "employment-2", startsOn: "2026-05-01" }),
      ),
    ).toBe(true)
  })

  test("normalizes to the latest non-void revision in deterministic order", () => {
    const schedule = normalizeLifecycleSchedule({
      ...emptySchedule(),
      employments: [
        employment({ periodId: "b", revision: 1, startsOn: "2027-01-01" }),
        employment({ revision: 1, endsOn: null }),
        employment({ revision: 2, endsOn: "2026-07-01", recordedByActionId: "action-2" }),
        employment({ periodId: "void", revision: 1 }),
        employment({ periodId: "void", revision: 2, isVoid: true }),
      ],
    })

    expect(
      schedule.employments.map(({ periodId, revision, endsOn }) => ({
        periodId,
        revision,
        endsOn,
      })),
    ).toEqual([
      { periodId: "employment-1", revision: 2, endsOn: "2026-07-01" },
      { periodId: "b", revision: 1, endsOn: null },
    ])
  })

  test("applies close, create, and void mutations without changing the input", () => {
    const original = normalizeLifecycleSchedule({
      ...emptySchedule(),
      employments: [employment()],
    })
    const closed = employment({
      revision: 2,
      endsOn: "2026-07-01",
      recordedByActionId: "action-2",
    })
    const future = employment({
      periodId: "employment-2",
      startsOn: "2027-01-01",
      recordedByActionId: "action-2",
    })

    const changed = applyLifecycleMutations(original, [
      { periodType: "employment", before: employment(), after: closed },
      { periodType: "employment", before: null, after: future },
      {
        periodType: "employment",
        before: future,
        after: { ...future, revision: 2, isVoid: true },
      },
    ])

    expect(original.employments).toEqual([employment()])
    expect(changed.employments).toEqual([closed])
  })
})
