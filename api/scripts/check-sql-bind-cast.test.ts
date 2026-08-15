import { collectSqlBindCastViolations, inspectSqlBindCast } from "./check-sql-bind-cast"
import { describe, expect, test } from "bun:test"

describe("bindパラメータへのCAST検出", () => {
  test("CAST(?n AS TEXT)を検出する", () => {
    const source = `
      db.prepare(\`
        SELECT 1 FROM system_accounts
        WHERE id = CAST(?1 AS TEXT)
      \`)
    `

    expect(inspectSqlBindCast("src/example.ts", source)).toEqual([
      {
        file: "src/example.ts",
        reason:
          "bindパラメータへのCASTはD1のREAL bindでTEXT affinity比較を壊します。bind側をString(...)で文字列化してください",
      },
    ])
  })

  test("大文字小文字・空白ゆれを検出する", () => {
    const source = 'db.prepare("SELECT cast (?3 as text) FROM accounts")'

    expect(inspectSqlBindCast("src/example.ts", source)).not.toEqual([])
  })

  test("文字列連結テンプレートの断片からも検出する", () => {
    const source = "const sql = `SELECT CAST(${column} AS BLOB), CAST(?2 AS TEXT)`"

    expect(inspectSqlBindCast("src/example.ts", source)).not.toEqual([])
  })

  test("カラムへのCASTは検出しない", () => {
    const source = `
      db.prepare(\`
        SELECT 1 FROM system_accounts
        WHERE id = CAST(rt.account_id AS TEXT)
      \`)
    `

    expect(inspectSqlBindCast("src/example.ts", source)).toEqual([])
  })

  test("CASTを含まないSQLは検出しない", () => {
    const source = `
      db.prepare(\`
        SELECT 1 FROM system_accounts
        WHERE id = ?1
      \`)
    `

    expect(inspectSqlBindCast("src/example.ts", source)).toEqual([])
  })
})

test("現在のsrcにbindパラメータへのCASTがない", async () => {
  expect(await collectSqlBindCastViolations()).toEqual([])
})
