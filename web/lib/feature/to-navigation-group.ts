import type { FeatureGroup } from "@/lib/feature/feature-types"

/**
 * サイドバーの表示グループを決める。
 * group は feature 単位だが、部署スコープの route は同じ feature の本人スコープ
 * （`/my/attendances` と `/teams/:team/attendances`）と別のセクションへ並べたい。
 * href が `/teams` で始まる route だけ部署セクションへ寄せ、残りは feature の group を使う。
 * 導出はここだけに置き、registry と sidebar の両方がこれを通す。
 */
export function toNavigationGroup(href: string, featureGroup: FeatureGroup): FeatureGroup {
  const segment = href.split("/")[1] ?? ""

  if (segment === "teams") return "team"

  return featureGroup
}
