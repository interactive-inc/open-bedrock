/** Onboarding が所有する権限key。 */
export const ONBOARDING_PERMISSION_KEYS = ["onboarding:manage", "onboarding:view:all"] as const

export type OnboardingPermissionKey = (typeof ONBOARDING_PERMISSION_KEYS)[number]
