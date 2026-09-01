/** HeadcountPlan が所有する権限key。 */
export const HEADCOUNT_PLAN_PERMISSION_KEYS = [
  "headcount_plan:manage",
  "headcount_plan:read:all",
] as const

export type HeadcountPlanPermissionKey = (typeof HEADCOUNT_PLAN_PERMISSION_KEYS)[number]
