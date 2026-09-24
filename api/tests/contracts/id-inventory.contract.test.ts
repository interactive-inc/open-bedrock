import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { SOFT_REFERENCES } from "../../scripts/id-inventory-registry"
import { buildIdInventory } from "../../scripts/inventory-ids"

/**
 * ID の棚卸しを migration と分類台帳に追従させる (Issue #1311)。
 *
 * 外部キーを宣言していない参照列は、UUID へ変換するときに書き換え漏れの原因になる。
 * 新しい列を足したら `id-inventory-registry.ts` に分類を書き、`bun run gen:id-inventory`
 * で生成物を更新する。
 */

const built = buildIdInventory()

describe("ID の棚卸し", () => {
  test("外部キーを持たない参照列はすべて分類済みで、台帳に古い項目が無い", () => {
    expect(built.problems.map((problem) => problem.reason)).toEqual([])
  })

  test("分類の無い参照列を検出する", () => {
    const [missing] = Object.keys(SOFT_REFERENCES)
    const registry = Object.fromEntries(
      Object.entries(SOFT_REFERENCES).filter(([key]) => key !== missing),
    )

    expect(missing).toBeDefined()
    expect(
      buildIdInventory(registry).problems.some((problem) =>
        problem.reason.endsWith(`: ${missing}`),
      ),
    ).toBe(true)
  })

  test("生成物 id-inventory.json が最新である", () => {
    const committed: unknown = JSON.parse(
      readFileSync(resolve(import.meta.dir, "../../id-inventory.json"), "utf8"),
    )

    expect(committed).toEqual(JSON.parse(JSON.stringify(built.inventory)))
  })
})
