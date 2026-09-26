import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { uuidSchema } from "@/lib/validation/uuid.schema"
import { PERMANENT_NON_UUID_PRIMARY_KEYS } from "../../scripts/id-inventory-registry"
import { buildIdInventory } from "../../scripts/inventory-ids"

/**
 * すべての table の主キーを UUID に揃える (Issue #1311)。
 *
 * 各 table は次のどれかに当てはまる。
 *
 * - UUID の主キーを持つ: 単一の TEXT 列で、`uuidCheckPredicate` の CHECK を持つ
 * - 恒久的な例外: 採番器・singleton・秘密値の照合鍵。理由は `id-inventory-registry.ts` に書く
 *
 * 移行はすべての table を変換して終わった。新しい table は最初から UUID の主キーで作る。
 */

const { inventory } = buildIdInventory()

const tableNames = Object.keys(inventory.tables)

describe("主キーは UUID に揃える (#1311)", () => {
  test("どの一覧にも無い table は UUID の主キーを持つ", () => {
    const violations = tableNames.filter(
      (table) =>
        !PERMANENT_NON_UUID_PRIMARY_KEYS.has(table) &&
        inventory.tables[table]?.primaryKey.uuidEnforced !== true,
    )

    expect(violations).toEqual([])
  })

  test("一覧の table はすべて実在する", () => {
    const stale = [...PERMANENT_NON_UUID_PRIMARY_KEYS.keys()].filter(
      (table) => inventory.tables[table] === undefined,
    )

    expect(stale).toEqual([])
  })

  test("恒久的な例外は理由を持ち、UUID にしない主キーである", () => {
    const violations = [...PERMANENT_NON_UUID_PRIMARY_KEYS].filter(
      ([table, exception]) =>
        exception.reason.trim().length === 0 ||
        inventory.tables[table]?.primaryKey.uuidEnforced === true,
    )

    expect(violations).toEqual([])
  })
})

describe("seed の UUID", () => {
  test("UUID の形をした seed の値は RFC 9562 に準拠する", () => {
    const seedsDirectory = resolve(import.meta.dir, "../../seeds")
    const violations = readdirSync(seedsDirectory)
      .filter((file) => file.endsWith(".sql"))
      .flatMap((file) =>
        [
          ...readFileSync(resolve(seedsDirectory, file), "utf8").matchAll(
            /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
          ),
        ]
          .map((match) => match[0])
          .filter((value) => !uuidSchema.safeParse(value).success)
          .map((value) => `${file}: ${value}`),
      )

    expect(violations).toEqual([])
  })
})
