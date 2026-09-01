/** Document が所有する権限key。 */
export const DOCUMENT_PERMISSION_KEYS = [
  "document:manage",
  "document:read:all",
] as const

export type DocumentPermissionKey = (typeof DOCUMENT_PERMISSION_KEYS)[number]
