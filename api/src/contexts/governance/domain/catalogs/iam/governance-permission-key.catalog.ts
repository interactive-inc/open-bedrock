/** Governance が所有する権限key。 */
export const GOVERNANCE_PERMISSION_KEYS = [
  "governance:acknowledge",
  "governance:manage",
  "governance:publish",
  "governance:read",
  "governance:read:restricted",
  "governance:review",
] as const

export type GovernancePermissionKey = (typeof GOVERNANCE_PERMISSION_KEYS)[number]
