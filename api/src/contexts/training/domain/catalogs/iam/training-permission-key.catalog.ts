/** Training が所有する権限key。 */
export const TRAINING_PERMISSION_KEYS = ["training:manage"] as const

export type TrainingPermissionKey = (typeof TRAINING_PERMISSION_KEYS)[number]
