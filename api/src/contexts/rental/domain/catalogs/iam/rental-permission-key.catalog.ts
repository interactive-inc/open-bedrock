/** Rental が所有する権限key。 */
export const RENTAL_PERMISSION_KEYS = ["rental:manage", "rental:read:all"] as const

export type RentalPermissionKey = (typeof RENTAL_PERMISSION_KEYS)[number]
