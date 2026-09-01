/** BusinessTrip が所有する権限key。 */
export const BUSINESS_TRIP_PERMISSION_KEYS = [
  "business_trip:manage",
  "business_trip:read:all",
] as const

export type BusinessTripPermissionKey = (typeof BUSINESS_TRIP_PERMISSION_KEYS)[number]
