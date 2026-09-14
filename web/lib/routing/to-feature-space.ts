import { featureRegistry } from "@/lib/feature/feature-registry"
import type { FeatureSpace } from "@/lib/feature/feature-types"

/**
 * 最も具体的に一致する登録ルートの管理領域でタブを決める。
 * 横断管理の配置先もここで決まるが、APIやcontextの実装配置は意味しない。
 * 本人・部署の閲覧範囲は所有区分を変えない。未登録ルートは URL prefix で補完する。
 */
export function toFeatureSpace(href: string): FeatureSpace {
  const segments = href.split("?")[0].split("#")[0].split("/").filter(Boolean)
  let matchedLength = -1
  let owner: FeatureSpace | null = null
  for (const feature of featureRegistry) {
    for (const route of feature.routes) {
      const parts = route.href.split("/").filter(Boolean)
      if (parts.length === 0 && segments.length !== 0) continue
      if (parts.length > segments.length || parts.length <= matchedLength) continue
      if (!parts.every((part, index) => part.startsWith(":") || part === segments[index])) continue
      matchedLength = parts.length
      owner = feature.tier === "system" ? "system" : feature.tier === "company" ? "company" : "apps"
    }
  }
  if (owner !== null) return owner
  const segment = href.split("/")[1] ?? ""

  if (segment === "system") return "system"

  if (segment === "company") return "company"

  return "apps"
}
