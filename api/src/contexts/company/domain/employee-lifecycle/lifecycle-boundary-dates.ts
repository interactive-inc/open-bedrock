import type { LifecycleSchedule } from "@/contexts/company/domain/employee-lifecycle/lifecycle-schedule"

/**
 * 全スケジュールの区間境界日（開始日・終了日）を重複なく昇順で返す。
 */
export function lifecycleBoundaryDates(
  schedules: ReadonlyArray<LifecycleSchedule>,
): ReadonlyArray<string> {
  const dates = new Set<string>()

  for (const schedule of schedules) {
    for (const period of [
      ...schedule.employments,
      ...schedule.statuses,
      ...schedule.assignments,
      ...schedule.responsibilities,
    ]) {
      dates.add(period.startsOn)

      if (period.endsOn !== null) {
        dates.add(period.endsOn)
      }
    }
  }

  return [...dates].sort()
}
