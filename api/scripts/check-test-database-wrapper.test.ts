import {
  type MigrationList,
  collectWrapperDependents,
  inspectWrapperMigration,
  resolveImport,
} from "./check-test-database-wrapper"
import { describe, expect, test } from "bun:test"

const wrapperHash = "a".repeat(64)

function listOf(dependents: Partial<MigrationList["dependents"]>): MigrationList {
  return {
    ownedWrapperSha256: wrapperHash,
    dependents: { business: [], sql: [], http: [], support: [], ...dependents },
  }
}

describe("D1互換テストラッパーの移行検査", () => {
  test("aliasと相対pathを解決する", () => {
    const files = new Set([
      "src/contexts/room/test/seed.ts",
      "tests/api/support/d1-test-database.ts",
    ])
    const exists = (path: string) => files.has(path)

    expect(
      resolveImport(
        "src/contexts/room/room.test.ts",
        "@tests/api/support/d1-test-database",
        exists,
      ),
    ).toBe("tests/api/support/d1-test-database.ts")
    expect(resolveImport("src/contexts/room/room.test.ts", "./test/seed", exists)).toBe(
      "src/contexts/room/test/seed.ts",
    )
    expect(resolveImport("src/contexts/room/room.test.ts", "bun:test", exists)).toBeNull()
  })

  test("テスト部品経由の間接依存を含め、共有contextは対象外にする", () => {
    const dependents = collectWrapperDependents(
      new Map([
        ["tests/api/support/d1-test-database.ts", ""],
        [
          "tests/api/support/create-test-context.ts",
          'import { createD1TestDatabase } from "@tests/api/support/d1-test-database"',
        ],
        [
          "src/contexts/room/room.test.ts",
          'import { createTestContext } from "@tests/api/support/create-test-context"',
        ],
        [
          "src/contexts/company/test/company.test.ts",
          'import { createD1TestDatabase } from "@tests/api/support/d1-test-database"',
        ],
        ["src/contexts/room/other.test.ts", 'import { test } from "bun:test"'],
      ]),
    )

    expect([...dependents].sort()).toEqual([
      "src/contexts/room/room.test.ts",
      "tests/api/support/create-test-context.ts",
    ])
  })

  test("一覧に無い新しい依存を拒否する", () => {
    const violations = inspectWrapperMigration(
      new Set(["src/contexts/room/new.test.ts"]),
      listOf({}),
      wrapperHash,
    )

    expect(violations.map((violation) => violation.file)).toEqual(["src/contexts/room/new.test.ts"])
  })

  test("移行済みで一覧に残った項目を拒否する", () => {
    const violations = inspectWrapperMigration(
      new Set(),
      listOf({ http: ["src/contexts/room/moved.test.ts"] }),
      wrapperHash,
    )

    expect(violations.map((violation) => violation.file)).toEqual([
      "src/contexts/room/moved.test.ts",
    ])
  })

  test("互換層の内容変更を拒否する", () => {
    const violations = inspectWrapperMigration(new Set(), listOf({}), "b".repeat(64))

    expect(violations.map((violation) => violation.file)).toEqual([
      "tests/api/support/d1-test-database.ts",
    ])
  })

  test("登録済みの依存だけなら通す", () => {
    expect(
      inspectWrapperMigration(
        new Set(["src/contexts/room/room.test.ts"]),
        listOf({ http: ["src/contexts/room/room.test.ts"] }),
        wrapperHash,
      ),
    ).toEqual([])
  })
})
