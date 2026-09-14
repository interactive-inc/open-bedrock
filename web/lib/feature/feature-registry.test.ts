import { describe, expect, test } from "vite-plus/test"

import { featureRegistry } from "@/lib/feature/feature-registry"

/**
 * 管理ナビゲーションのラベルとURL境界を検査する。
 */
describe("featureRegistry のラベル", () => {
  test("サイドバーに並ぶラベルが重複しない", () => {
    const labels = featureRegistry.flatMap((feature) => feature.routes.map((route) => route.label))

    const seen = new Set<string>()
    const duplicated: Array<string> = []

    for (const label of labels) {
      if (seen.has(label)) duplicated.push(label)
      seen.add(label)
    }

    expect(duplicated).toEqual([])
  })

  test("本人・所属部署専用の入口を管理メニューへ再導入しない", () => {
    const personalRoutes = featureRegistry
      .flatMap((feature) => feature.routes)
      .filter((route) => /^\/(my|teams)(\/|$)/.test(route.href))

    expect(personalRoutes).toEqual([])
  })

  test("context別URLと明示した横断URLだけを登録する", () => {
    const hrefs = featureRegistry.flatMap((feature) => feature.routes.map((route) => route.href))

    const compositionHrefs = new Set(["/inbox", "/application-templates"])

    const invalid = hrefs.filter((href) => {
      if (compositionHrefs.has(href)) return false

      return href.split("/").length < 3
    })

    expect(invalid).toEqual([])
  })
})
