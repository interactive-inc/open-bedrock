/** Meeting が所有する権限key。 */
export const MEETING_PERMISSION_KEYS = [
  "decision:manage",
  "meeting:manage",
] as const

export type MeetingPermissionKey = (typeof MEETING_PERMISSION_KEYS)[number]
