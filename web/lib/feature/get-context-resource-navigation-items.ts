import { House } from "lucide-react"
import { contextResourceCatalog } from "@/lib/feature/context-resource-catalog"
import type { FeatureNavigationItem } from "@/lib/feature/feature-types"

/** 一覧とサイドメニューを同じリソース定義に揃え、既存画面の権限は維持する。 */
export function getContextResourceNavigationItems(
  owner: "system" | "company",
  existing: ReadonlyArray<FeatureNavigationItem>,
): ReadonlyArray<FeatureNavigationItem> {
  const overview: FeatureNavigationItem = {
    slug: `${owner}-resources`,
    tier: owner,
    status: "available",
    group: "overview",
    icon: House,
    prefetch: null,
    label: "ホーム",
    href: `/${owner}`,
    visibility: { kind: "permission", permission: "system:admin" },
  }
  return [
    overview,
    ...contextResourceCatalog
      .filter((resource) => resource.owner === owner)
      .flatMap((resource): ReadonlyArray<FeatureNavigationItem> => {
        const view = existing.find((item) => item.href === resource.view)
        if (!view) return []
        return [{ ...view, label: resource.label, group: resource.group }]
      }),
  ]
}
