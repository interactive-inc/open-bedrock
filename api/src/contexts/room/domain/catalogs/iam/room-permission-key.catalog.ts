/** Room が所有する権限key。 */
export const ROOM_PERMISSION_KEYS = ["room:manage"] as const

export type RoomPermissionKey = (typeof ROOM_PERMISSION_KEYS)[number]
