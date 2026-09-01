/** Asset が所有する権限key。 */
export const ASSET_PERMISSION_KEYS = ["asset:manage"] as const

export type AssetPermissionKey = (typeof ASSET_PERMISSION_KEYS)[number]
