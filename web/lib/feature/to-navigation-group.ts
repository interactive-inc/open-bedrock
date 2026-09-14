import type { FeatureGroup } from "@/lib/feature/feature-types"
import { toFeatureSpace } from "@/lib/routing/to-feature-space"

/**
 * サイドバーの表示グループを決める。
 * System の汎用手続きは「案件と判断」、通知は「非同期処理」に置く。
 * 会社の部署情報は組織、各業務のデータはその業務のグループに置く。
 * 導出はここだけに置き、registry と sidebar の両方がこれを通す。
 */
export function toNavigationGroup(href: string, featureGroup: FeatureGroup): FeatureGroup {
  const segment = href.split("/")[1] ?? ""

  const owner = toFeatureSpace(href)
  if (segment === "inbox" || segment === "application-templates") return "cross-context"
  if (owner === "system" && featureGroup === "requests") return "system-case"
  if (owner === "system" && segment === "notifications") return "system-async"
  if (owner === "company" && segment === "teams") return "company-organization"
  if (owner === "company" && featureGroup === "team") return "company-organization"

  return featureGroup
}
