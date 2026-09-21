import { expect, test } from "bun:test"
import { Glob } from "bun"
import { readFileSync } from "node:fs"

const contextDirectory = new URL("..", import.meta.url)
const productionFiles = [...new Glob("**/*.ts").scanSync({ cwd: contextDirectory.pathname })]
  .filter(
    (file) =>
      !file.endsWith(".test.ts") && !file.endsWith(".test-support.ts") && !file.startsWith("test/"),
  )
  .sort()

const WRITES_WORKFORCE_TABLE =
  /(?:INSERT(?:\s+OR\s+[A-Z]+)?\s+INTO|UPDATE|DELETE\s+FROM)\s+company_(?:employees|employments|account_employee_links)\b|\.(?:insert|update|delete)\(\s*(?:employees|employments|accountEmployeeLinks)\s*\)/u

/**
 * 従業員、雇用、Account との対応の表は、公開 resource の投影として書く。
 *
 * 表を手で書く実装が増えると、同じ事実を公開履歴と表の二か所へ別々に書く状態へ戻る。表へ書く
 * 製品のコードを次の 4 つに固定し、増やすときはこの一覧と理由を一緒に変える。
 */
const ALLOWED_WRITERS = [
  // 公開した雇用を、雇用の表と期間へ投影する。
  "infrastructure/adapters/employee/company-employment-resource-projection.adapter.ts",
  // 公開した人、従業員、Account との対応を表へ投影する。
  "infrastructure/adapters/employee/company-workforce-resource-projection.adapter.ts",
  // 公開履歴へ未接続の雇用への人事発令と、訂正で元の発令を戻す段階の一時的な開き直し。
  "infrastructure/adapters/employee-lifecycle/personnel-action-persistence.adapter.ts",
  // 会社の初期構築の、Account と従業員の対応の挿入。
  "infrastructure/repositories/organization/company-bootstrap.repository.ts",
]

test("従業員、雇用、対応の表へ書く製品のコードを、投影と決められた例外に限る", () => {
  const writers = productionFiles.filter((file) =>
    WRITES_WORKFORCE_TABLE.test(readFileSync(new URL(file, contextDirectory), "utf8")),
  )

  expect(writers).toEqual(ALLOWED_WRITERS.toSorted())
})
