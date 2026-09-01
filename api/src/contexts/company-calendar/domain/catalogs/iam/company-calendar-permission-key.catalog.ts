/** CompanyCalendar が所有する権限key。 */
export const COMPANY_CALENDAR_PERMISSION_KEYS = [
  "calendar:manage",
] as const

export type CompanyCalendarPermissionKey = (typeof COMPANY_CALENDAR_PERMISSION_KEYS)[number]
