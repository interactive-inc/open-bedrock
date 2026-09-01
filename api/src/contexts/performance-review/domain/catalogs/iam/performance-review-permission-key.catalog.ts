/** PerformanceReview が所有する権限key。 */
export const PERFORMANCE_REVIEW_PERMISSION_KEYS = [
  "evaluation:administer",
  "goal:evaluate",
  "goal:evaluate:reports",
  "goal:read:all",
  "goal:read:department",
  "goal:read:reports",
  "review:administer",
] as const

export type PerformanceReviewPermissionKey = (typeof PERFORMANCE_REVIEW_PERMISSION_KEYS)[number]
