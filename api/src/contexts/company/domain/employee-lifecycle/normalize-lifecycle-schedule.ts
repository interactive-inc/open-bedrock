import { latestVisiblePeriods } from "@/contexts/company/domain/employee-lifecycle/latest-visible-periods"
import type { LifecycleSchedule } from "@/contexts/company/domain/employee-lifecycle/lifecycle-schedule"

/**
 * 各系列を最新リビジョン・void 除去・決定的な順序に正規化する。
 */
export function normalizeLifecycleSchedule(schedule: LifecycleSchedule): LifecycleSchedule {
  return {
    employments: latestVisiblePeriods(schedule.employments),
    statuses: latestVisiblePeriods(schedule.statuses),
    assignments: latestVisiblePeriods(schedule.assignments),
    responsibilities: latestVisiblePeriods(schedule.responsibilities),
  }
}
