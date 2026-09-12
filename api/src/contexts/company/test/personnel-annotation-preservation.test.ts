import { expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"

const files = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
const cutover = files.findIndex((file) =>
  file.endsWith("_preserve_company_personnel_annotations.sql"),
)
const read = (file: string) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8")
const columns =
  "CAST(id AS TEXT) AS id, employee_id, kind, effective_date, from_department_code, to_department_code, note, created_at"

test("注記の全列と大きなID・不明日付・孤立した対象を保全し、変更と削除を禁止する", async () => {
  expect(cutover).toBeGreaterThan(0)
  const database = createCompanyD1TestDatabase(files.slice(0, cutover).map(read).join("\n"))
  await database
    .prepare(`INSERT INTO company_employee_events VALUES
    (9223372036854775807, 'orphan:source', 'unknown-kind', 'date unknown', ' OLD ', '', '  original note  ', 'original timestamp'),
    (-2, '', '', '', NULL, NULL, '', ''),
    (3, 'missing', 'retire', '2020-01-01', NULL, NULL, NULL, '2021-02-03')`)
    .run()
  const before = await database
    .prepare(`SELECT ${columns} FROM company_employee_events ORDER BY id`)
    .all()
  for (const file of files.slice(cutover)) await database.exec(read(file))
  const after = await database
    .prepare(`SELECT ${columns} FROM company_personnel_annotations ORDER BY id`)
    .all()
  expect(after.results).toEqual(before.results)
  expect(
    await database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'company_employee_events'",
      )
      .first(),
  ).toBeNull()
  for (const sql of [
    "UPDATE company_personnel_annotations SET note = 'changed'",
    "DELETE FROM company_personnel_annotations",
    "INSERT OR REPLACE INTO company_personnel_annotations VALUES (-2, 'changed', '', '', NULL, NULL, '', '')",
  ])
    expect(
      await database
        .prepare(sql)
        .run()
        .catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
  expect(
    (
      await database
        .prepare(`SELECT ${columns} FROM company_personnel_annotations ORDER BY id`)
        .all()
    ).results,
  ).toEqual(before.results)
})
