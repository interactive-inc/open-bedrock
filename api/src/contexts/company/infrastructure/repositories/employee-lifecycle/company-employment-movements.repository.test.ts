import { expect, test } from "bun:test"
import { CompanyEmploymentMovementsRepository } from "@/contexts/company/infrastructure/repositories/employee-lifecycle/company-employment-movements.repository"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

const schema = `CREATE TABLE company_organizations (id TEXT PRIMARY KEY, revision INTEGER NOT NULL);
CREATE TABLE company_employments (id TEXT PRIMARY KEY, employee_id TEXT);
CREATE TABLE company_workforce_resource_bindings (resource_type TEXT, resource_id TEXT, organization_id TEXT);
CREATE TABLE company_resource_revisions (organization_id TEXT, resource_type TEXT, resource_id TEXT,
revision INTEGER, organization_revision INTEGER, state TEXT, effective_from TEXT, effective_to TEXT, attributes_json TEXT);
INSERT INTO company_organizations VALUES ('organization:one', 3), ('organization:other', 1);`
const query = {
  organizationId: "organization:one",
  organizationRevision: 1,
  from: "2026-06-01",
  through: "2026-06-15",
}
async function fixture() {
  const database = createCompanyD1TestDatabase(schema)
  for (const row of [
    ["organization:one", "employment:one", 1, 1, "active", "2026-06-01", "2026-06-10"],
    ["organization:one", "employment:one", 2, 2, "active", "2026-06-01", "2026-06-20"],
    ["organization:one", "employment:one", 3, 3, "void", "2026-06-01", "2026-06-20"],
    ["organization:other", "employment:other", 1, 1, "active", "2026-06-02", null],
  ]) {
    await database
      .prepare(
        `INSERT INTO company_resource_revisions VALUES (?, 'employment', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        ...row,
        JSON.stringify({
          employeeId: "employee:one",
          employmentType: "FULL_TIME",
          status: "ACTIVE",
        }),
      )
      .run()
  }
  return database
}

test("後続の訂正・取消があっても指定した会社版の集計を返す", async () => {
  const database = await fixture()
  const repository = new CompanyEmploymentMovementsRepository({ env: { DB: database } })
  expect(await repository.find(query)).toEqual({ joinCount: 1, retireCount: 1 })
  expect(await repository.find({ ...query, organizationRevision: 2 })).toEqual({
    joinCount: 1,
    retireCount: 0,
  })
  expect(await repository.find({ ...query, organizationRevision: 3 })).toEqual({
    joinCount: 0,
    retireCount: 0,
  })
})

test("別会社の履歴を混ぜず、存在しない会社と未来の版を拒否する", async () => {
  const database = await fixture()
  const repository = new CompanyEmploymentMovementsRepository({ env: { DB: database } })
  expect(await repository.find({ ...query, organizationId: "organization:other" })).toEqual({
    joinCount: 1,
    retireCount: 0,
  })
  expect(
    await repository.find({ ...query, organizationId: "organization:missing" }),
  ).toBeInstanceOf(Error)
  expect(await repository.find({ ...query, organizationRevision: 4 })).toBeInstanceOf(Error)
  expect(await repository.find({ ...query, organizationRevision: -1 })).toBeInstanceOf(Error)
})

test("壊れた保存内容や読取失敗をゼロ件に読み替えない", async () => {
  const database = await fixture()
  const repository = new CompanyEmploymentMovementsRepository({ env: { DB: database } })
  await database
    .prepare(
      "UPDATE company_resource_revisions SET attributes_json = 'invalid' WHERE organization_id = 'organization:one' AND revision = 1",
    )
    .run()
  expect(await repository.find(query)).toBeInstanceOf(Error)
  await database.prepare("DROP TABLE company_resource_revisions").run()
  expect(await repository.find(query)).toBeInstanceOf(Error)
})

test("既存契約の一部でも公開履歴へ未接続なら部分集計を返さない", async () => {
  const database = await fixture()
  const repository = new CompanyEmploymentMovementsRepository({ env: { DB: database } })
  await database
    .prepare("INSERT INTO company_employments VALUES ('employment:unconnected', 'employee:one')")
    .run()
  await database
    .prepare(
      "INSERT INTO company_workforce_resource_bindings VALUES ('employment', 'employment:unconnected', 'organization:one')",
    )
    .run()
  expect(await repository.find(query)).toBeInstanceOf(Error)
})
