import { expect, test } from "bun:test"
import { DefinitionResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/definitions/definition-resource-adoption-snapshot.adapter"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

function fixture() {
  const database = createCompanyD1TestDatabase(`
    CREATE TABLE company_organizations(id TEXT PRIMARY KEY, revision INTEGER NOT NULL);
    INSERT INTO company_organizations VALUES ('organization:default', 4);
    CREATE TABLE company_grade_definitions(id INTEGER PRIMARY KEY, code TEXT, name TEXT,
      rank INTEGER, description TEXT, created_at TEXT);
    CREATE TABLE company_position_definitions(id INTEGER PRIMARY KEY, code TEXT, name TEXT,
      rank INTEGER, description TEXT, created_at TEXT);
    INSERT INTO company_grade_definitions VALUES (1, 'G1', 'Grade title', 2, NULL, '2020-01-01T00:00:00Z');
    INSERT INTO company_position_definitions VALUES (1, 'P1', 'Position title', 3, 'Details', '2021-01-01T00:00:00Z');
    CREATE TABLE adoption_effect(id INTEGER PRIMARY KEY);
  `)
  return { database, adapter: new DefinitionResourceAdoptionSnapshotAdapter(database) }
}

test("同じ数値IDを持つ等級と役職を区別し、会社版と元の記録を一緒に固定する", async () => {
  const f = fixture()
  const grade = await f.adapter.find("grade", 1)
  const position = await f.adapter.find("position", 1)
  if (grade === null || grade instanceof Error || position === null || position instanceof Error)
    throw new Error("missing definition snapshot")
  expect(grade.props.value).toMatchObject({
    organizationRevision: 4,
    definition: { type: "grade", name: "Grade title", rank: 2, description: null },
  })
  expect(position.props.value.definition).toMatchObject({
    type: "position",
    name: "Position title",
  })
  expect(grade.props.digest).not.toBe(position.props.digest)
  expect(await f.adapter.find("grade", 2)).toBeNull()
  await f.database.batch([
    f.adapter.prepareGuard(grade),
    f.database.prepare("INSERT INTO adoption_effect VALUES (1)"),
  ])
  expect(
    await f.database
      .prepare("SELECT count(*) AS total FROM adoption_effect")
      .first<number>("total"),
  ).toBe(1)
})

test("確認から保存までの定義変更・削除・会社版変更を検出し、同じbatchの副作用を残さない", async () => {
  for (const sql of [
    "UPDATE company_grade_definitions SET name = 'Changed' WHERE id = 1",
    "UPDATE company_grade_definitions SET rank = 7 WHERE id = 1",
    "DELETE FROM company_grade_definitions WHERE id = 1",
    "UPDATE company_organizations SET revision = 5",
  ]) {
    const f = fixture()
    const snapshot = await f.adapter.find("grade", 1)
    if (snapshot === null || snapshot instanceof Error) throw new Error("missing snapshot")
    await f.database.prepare(sql).run()
    const failure = await f.database
      .batch([
        f.database.prepare("INSERT INTO adoption_effect VALUES (1)"),
        f.adapter.prepareGuard(snapshot),
      ])
      .catch((cause: unknown) => cause)
    expect(failure).toBeInstanceOf(Error)
    expect(
      await f.database
        .prepare("SELECT count(*) AS total FROM adoption_effect")
        .first<number>("total"),
    ).toBe(0)
  }
})

test("会社版や作成日時が読めない記録を確認済みとして返さない", async () => {
  const f = fixture()
  await f.database.prepare("UPDATE company_grade_definitions SET created_at = 'unknown'").run()
  expect(await f.adapter.find("grade", 1)).toBeInstanceOf(Error)
  await f.database.prepare("DELETE FROM company_organizations").run()
  expect(await f.adapter.find("position", 1)).toBeInstanceOf(Error)
})
