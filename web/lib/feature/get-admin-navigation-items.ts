import type { FeatureNavigationItem, FeatureSpace } from "@/lib/feature/feature-types"
import { getFeatureNavigationItems } from "@/lib/feature/get-feature-navigation-items"
import { getContextResourceNavigationItems } from "@/lib/feature/get-context-resource-navigation-items"
import { House } from "lucide-react"

/** サイドバーと検索で同じ管理ルート・権限・機能ゲートを使用する。 */
export function getAdminNavigationItems(
  permissions: ReadonlyArray<string>,
  disabledFeatures: ReadonlyArray<string>,
): ReadonlyArray<FeatureNavigationItem> {
  const keys = new Set(permissions)
  const spaces: ReadonlyArray<FeatureSpace> = ["system", "company", "composition", "apps"]
  return spaces
    .flatMap((space) => {
      const existing = getFeatureNavigationItems(space, null, disabledFeatures)
      if (space === "system" || space === "company")
        return getContextResourceNavigationItems(space, existing)
      if (space === "composition")
        return [
          {
            slug: "composition-resources",
            tier: "system",
            status: "available",
            group: "overview",
            icon: House,
            prefetch: null,
            label: "ホーム",
            href: "/composition",
            visibility: { kind: "permission", permission: "system:admin" },
          } satisfies FeatureNavigationItem,
          ...existing,
        ]
      return existing
    })
    .filter((item) => {
      const visibility = item.visibility
      if (visibility.kind === "everyone") return true
      if (visibility.kind === "permission") return keys.has(visibility.permission)
      if (visibility.kind === "any-permission")
        return visibility.permissions.some((key) => keys.has(key))
      return visibility.permissions.every((key) => keys.has(key))
    })
}
