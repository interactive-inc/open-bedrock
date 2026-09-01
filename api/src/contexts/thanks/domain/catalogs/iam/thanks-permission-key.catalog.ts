/** Thanks が所有する権限key。 */
export const THANKS_PERMISSION_KEYS = [
  "thanks_redemption:approve",
  "thanks_redemption:read:all",
  "thanks_reward:manage",
] as const

export type ThanksPermissionKey = (typeof THANKS_PERMISSION_KEYS)[number]
