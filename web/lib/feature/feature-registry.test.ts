import { describe, expect, test } from "vite-plus/test"

import { featureRegistry } from "@/lib/feature/feature-registry"

/**
 * サイドバーは my と teams の項目を同じ空間に並べて表示する
 * （components/sidebar-nav.tsx の "other" 空間）。
 * ラベルが重複すると、どちらが自分用でどちらが部署用か区別できなくなる。
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

  test("my と teams で同じ機能を指す項目は接頭辞で区別する", () => {
    // my 側は素のラベル、teams 側は「部署の〜」にする取り決め。
    const myLabels = new Set(
      featureRegistry.flatMap((feature) =>
        feature.routes.filter((route) => route.space === "my").map((route) => route.label),
      ),
    )

    const teamsLabels = featureRegistry.flatMap((feature) =>
      feature.routes.filter((route) => route.space === "teams").map((route) => route.label),
    )

    // teams 側のラベルが my 側と衝突していないこと
    const collided = teamsLabels.filter((label) => myLabels.has(label))

    expect(collided).toEqual([])
  })
})
