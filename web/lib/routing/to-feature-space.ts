import type { FeatureSpace } from "@/lib/feature/feature-types"

/**
 * URL の第 1 セグメントから所有者の空間を決める。
 * `/system` は System、`/company` は Company、それ以外は App の業務空間。
 * サイドバーのタブと URL prefix を二重管理しないため、判定はここだけに置く。
 */
export function toFeatureSpace(href: string): FeatureSpace {
  const segment = href.split("/")[1] ?? ""

  if (segment === "system") return "system"

  if (segment === "company") return "company"

  return "apps"
}
