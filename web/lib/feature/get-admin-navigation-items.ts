import type { FeatureNavigationItem, FeatureSpace } from "@/lib/feature/feature-types"
import { getFeatureNavigationItems } from "@/lib/feature/get-feature-navigation-items"

/** サイドバーと検索で同じ管理ルート・権限・機能ゲートを使用する。 */
export function getAdminNavigationItems(
  permissions: ReadonlyArray<string>,
  disabledFeatures: ReadonlyArray<string>,
): ReadonlyArray<FeatureNavigationItem> {
  const keys = new Set(permissions)
  const spaces: ReadonlyArray<FeatureSpace> = ["system", "company", "apps"]
  return spaces
    .flatMap((space) => getFeatureNavigationItems(space, null, disabledFeatures))
    .filter((item) => {
      const visibility = item.visibility
      if (visibility.kind === "everyone") return true
      if (visibility.kind === "permission") return keys.has(visibility.permission)
      if (visibility.kind === "any-permission")
        return visibility.permissions.some((key) => keys.has(key))
      return visibility.permissions.every((key) => keys.has(key))
    })
}
