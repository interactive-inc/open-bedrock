/** SoftwareLicense が所有する権限key。 */
export const SOFTWARE_LICENSE_PERMISSION_KEYS = [
  "license:manage",
  "license:read:all",
] as const

export type SoftwareLicensePermissionKey = (typeof SOFTWARE_LICENSE_PERMISSION_KEYS)[number]
