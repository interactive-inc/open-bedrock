import type { LifecyclePeriodBase } from "@/contexts/company/domain/employee-lifecycle/lifecycle-schedule"

/**
 * 2つの半開区間が重なるか判定する。境界の共有は重なりとみなさない。
 */
export function periodsOverlap(left: LifecyclePeriodBase, right: LifecyclePeriodBase): boolean {
  return (
    (right.endsOn === null || left.startsOn < right.endsOn) &&
    (left.endsOn === null || right.startsOn < left.endsOn)
  )
}
