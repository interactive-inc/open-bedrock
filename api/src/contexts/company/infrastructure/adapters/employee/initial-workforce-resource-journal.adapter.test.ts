import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { drizzle } from "drizzle-orm/d1"
import {
  InitialWorkforceResourceJournalAdapter,
  type InitialWorkforceResource,
} from "@/contexts/company/infrastructure/adapters/employee/initial-workforce-resource-journal.adapter"
import { InitialEmploymentPersistenceAdapter } from "@/contexts/company/infrastructure/adapters/employee/initial-employment-persistence.adapter"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
const organizationId = "organization:default"

function input(id: string): InitialWorkforceResource {
  return {
    employeeId: restoreWorkforceId("employee", `employee:${id}`),
    employmentId: restoreWorkforceId("employment", `employment:${id}`),
    officialName: "Example Person",
    employeeCode: id,
    email: "you@example.com",
    phone: null,
    employmentType: "PART_TIME",
    status: "leave",
    effectiveOn: restoreCalendarDate("2026-09-01"),
    occurredAt: new Date("2026-08-01T00:00:00Z"),
    actorAccountId: "account:operator",
    operationId: `initial:${id}`,
    reason: "Confirmed new employment",
    lifecycleRevision: 0,
  }
}
function context(database: D1Database) {
  return { env: { DB: database }, var: { database: drizzle(database) } }
}
async function initialStatements(database: D1Database, item: InitialWorkforceResource) {
  const lifecycle = await new InitialEmploymentPersistenceAdapter(context(database)).prepare(item)
  if (lifecycle instanceof Error) throw lifecycle
  return [
    database
      .prepare(`INSERT INTO company_employees
      (id, official_name, employee_code, email, phone, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`)
      .bind(
        item.employeeId,
        item.officialName,
        item.employeeCode,
        item.email,
        item.phone,
        item.occurredAt.getTime(),
      ),
    database
      .prepare(`INSERT INTO company_employments
      (id, employee_id, contract_name, employment_type, hire_date, status, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)`)
      .bind(
        item.employmentId,
        item.employeeId,
        item.officialName,
        item.employmentType,
        item.effectiveOn,
        item.status === "active" ? "ACTIVE" : "ON_LEAVE",
        item.occurredAt.getTime(),
      ),
    ...lifecycle,
  ]
}
async function prepare(database: D1Database, item: InitialWorkforceResource) {
  const journal = await new InitialWorkforceResourceJournalAdapter(context(database)).prepare(item)
  if (journal instanceof Error) throw journal
  return [...(await initialStatements(database, item)), ...journal]
}
async function read(database: D1Database) {
  const result = await new D1CompanyResourceRepository(database).findMany({
    organizationId,
    types: ["person", "employee", "employment"],
    effectiveOn: restoreCalendarDate("2026-09-01"),
  })
  if (!result.ok) throw result.cause
  return result
}

describe("新規登録から公開Company正本への接続", () => {
  test("一括登録でも版を衝突させず、契約区分と初期の休職状態を保全する", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    const items = [
      input("one"),
      { ...input("two"), status: "active" } satisfies InitialWorkforceResource,
    ]
    const journal = await new InitialWorkforceResourceJournalAdapter(context(database)).buildMany(
      items,
    )
    if (journal instanceof Error) throw journal
    const initial = (
      await Promise.all(items.map((item) => initialStatements(database, item)))
    ).flat()
    await database.batch([
      ...initial,
      ...journal.map((statement) => {
        const query = statement.toSQL()
        return database.prepare(query.sql).bind(...query.params)
      }),
    ])
    const snapshot = await read(database)
    expect(snapshot.organizationRevision).toBe(2)
    expect(snapshot.resources).toHaveLength(6)
    expect(
      snapshot.resources.find((resource) => resource.id === "employment:one")?.attributes,
    ).toMatchObject({
      employmentType: "PART_TIME",
      status: "ON_LEAVE",
    })
    const before = await new D1CompanyResourceRepository(database).findMany({
      organizationId,
      types: ["employee"],
      effectiveOn: restoreCalendarDate("2026-08-31"),
    })
    expect(before).toMatchObject({ ok: true, resources: [] })
    const employment = snapshot.resources.find((resource) => resource.id === "employment:one")
    if (employment === undefined) throw new Error("missing employment")
    const change = CompanyResourceChangeEntity.create({
      commandId: "public:return",
      expectedRevision: snapshot.organizationRevision,
      actorAccountId: "account:operator",
      reason: "Return to work",
      recordedAt: Date.parse("2026-10-01"),
      resources: [
        {
          organizationId: employment.organizationId,
          type: employment.type,
          id: employment.id,
          state: employment.state,
          effectiveTo: employment.effectiveTo,
          revision: 2,
          effectiveFrom: restoreCalendarDate("2026-10-01"),
          attributes: { ...employment.attributes, status: "ACTIVE" },
        },
      ],
    })
    if (change instanceof Error) throw change
    expect(await new D1CompanyResourceRepository(database).write(change)).toMatchObject({
      kind: "applied",
    })
    expect(
      await database
        .prepare("SELECT count(*) AS total FROM company_personnel_actions")
        .first<number>("total"),
    ).toBe(3)
  })

  test("公開履歴の保存に失敗したら新規従業員と初期履歴も戻し、再試行できる", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    await database.exec(
      "CREATE TRIGGER reject_initial_resource BEFORE INSERT ON company_resource_revisions BEGIN SELECT RAISE(ABORT, 'resource unavailable'); END;",
    )
    const statements = await prepare(database, input("rollback"))
    expect(await database.batch(statements).catch((cause: unknown) => cause)).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT count(*) AS total FROM company_employees")
        .first<number>("total"),
    ).toBe(0)
    expect(
      await database
        .prepare("SELECT count(*) AS total FROM company_personnel_actions")
        .first<number>("total"),
    ).toBe(0)
    expect((await read(database)).organizationRevision).toBe(0)
    await database.exec("DROP TRIGGER reject_initial_resource")
    await database.batch(statements)
    expect((await read(database)).resources).toHaveLength(3)
  })

  test("初期宣言と保存内容が異なるときは対応を作らない", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    const item = input("mismatch")
    const journal = await new InitialWorkforceResourceJournalAdapter(context(database)).prepare({
      ...item,
      employmentType: "FULL_TIME",
    })
    if (journal instanceof Error) throw journal
    expect(
      await database
        .batch([...(await initialStatements(database, item)), ...journal])
        .catch((cause: unknown) => cause),
    ).toBeInstanceOf(Error)
    expect((await read(database)).resources).toHaveLength(0)
    expect(
      await database
        .prepare("SELECT count(*) AS total FROM company_workforce_resource_bindings")
        .first<number>("total"),
    ).toBe(0)
  })

  test("異なる新規登録の競合でも一方だけを確定し、再準備した登録は成功する", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    const one = await prepare(database, input("one"))
    const two = await prepare(database, input("two"))
    await database.batch(one)
    expect(await database.batch(two).catch((cause: unknown) => cause)).toBeInstanceOf(Error)
    expect(
      await database.prepare("SELECT id FROM company_employees WHERE id = 'employee:two'").first(),
    ).toBeNull()
    await database.batch(await prepare(database, input("two")))
    expect((await read(database)).organizationRevision).toBe(2)
    expect((await read(database)).resources).toHaveLength(6)
  })

  test("接続済みデータの再初期化と主体の欠落を拒否する", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    const item = input("existing")
    await database.batch(await prepare(database, item))
    const adapter = new InitialWorkforceResourceJournalAdapter(context(database))
    const repeated = await adapter.prepare(item)
    if (repeated instanceof Error) throw repeated
    expect(await database.batch([...repeated]).catch((cause: unknown) => cause)).toBeInstanceOf(
      Error,
    )
    expect((await read(database)).organizationRevision).toBe(1)
    expect(await adapter.prepare({ ...input("other"), actorAccountId: "" })).toBeInstanceOf(Error)
  })
})
