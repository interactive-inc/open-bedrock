import { featureRegistry } from "@/lib/feature/feature-registry"
import type { FeatureNavigationItem, FeatureSpace } from "@/lib/feature/feature-types"

/**
 * 空間に属する表示可能な経路を、部署コードを解決して返す。
 * disabledFeatureSlugs（機能ゲートで無効な機能）は表示から除く。
 */
export function getFeatureNavigationItems(
  space: FeatureSpace,
  teamCode: string | null,
  disabledFeatureSlugs: ReadonlyArray<string> = [],
): ReadonlyArray<FeatureNavigationItem> {
  const navigationItems: Array<FeatureNavigationItem> = []

  const disabledSlugSet = new Set(disabledFeatureSlugs)

  for (const feature of featureRegistry) {
    if (feature.status === "retirement-candidate") continue
    if (disabledSlugSet.has(feature.slug)) continue

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
