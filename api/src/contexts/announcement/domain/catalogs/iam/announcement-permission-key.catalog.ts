/** Announcement が所有する権限key。 */
export const ANNOUNCEMENT_PERMISSION_KEYS = [
  "announcement:manage",
] as const

export type AnnouncementPermissionKey = (typeof ANNOUNCEMENT_PERMISSION_KEYS)[number]
