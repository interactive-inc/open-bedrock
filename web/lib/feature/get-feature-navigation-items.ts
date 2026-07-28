import { featureRegistry } from "@/lib/feature/feature-registry"
import type { FeatureNavigationItem, FeatureSpace } from "@/lib/feature/feature-types"

/**
 * 空間に属する表示可能な経路を、部署コードを解決して返す。
 */
export function getFeatureNavigationItems(
  space: FeatureSpace,
  teamCode: string | null,
): ReadonlyArray<FeatureNavigationItem> {
  const navigationItems: Array<FeatureNavigationItem> = []

  for (const feature of featureRegistry) {
    if (feature.status === "retirement-candidate") continue

    for (const route of feature.routes) {
      if (route.space !== space) continue
      if (route.href.includes(":team") && teamCode === null) continue

      navigationItems.push({
        slug: feature.slug,
        tier: feature.tier,
        status: feature.status,
        group: feature.group,
        icon: feature.icon,
        prefetch: feature.prefetch,
        label: route.label,
        href: route.href.replace(":team", teamCode ?? ""),
        visibility: route.visibility,
      })
    }
  }

  return navigationItems
}
