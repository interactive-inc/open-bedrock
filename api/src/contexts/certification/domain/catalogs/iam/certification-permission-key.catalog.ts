/** Certification が所有する権限key。 */
export const CERTIFICATION_PERMISSION_KEYS = [
  "certification:manage",
  "certification:read:all",
] as const

export type CertificationPermissionKey = (typeof CERTIFICATION_PERMISSION_KEYS)[number]
