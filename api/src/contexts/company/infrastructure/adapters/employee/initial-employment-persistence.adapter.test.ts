import { drizzle } from "drizzle-orm/d1"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { InitialEmploymentPersistenceAdapter } from "@/contexts/company/infrastructure/adapters/employee/initial-employment-persistence.adapter"
import { ResolveLiveEmployeeAccessAdapter } from "@/contexts/company/infrastructure/adapters/employee/resolve-live-employee-access.adapter"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
const employeeId = restoreWorkforceId("employee", "employee:initial")
const employmentId = restoreWorkforceId("employment", "employment:initial")
const input = {
  employeeId,
  employmentId,
  effectiveOn: restoreCalendarDate("2026-09-01"),
  occurredAt: new Date("2026-08-01T00:00:00Z"),
  actorAccountId: null,
  operationId: "provision:initial",
  reason: "Import confirmed employment facts",
}

async function prepare(database: D1Database) {
  const statements = await new InitialEmploymentPersistenceAdapter({
    env: { DB: database },
    var: { database: drizzle(database) },
  }).prepare({
    ...input,
    status: "active",
  })
  if (statements instanceof Error) throw statements
  return statements
}

function employeeStatements(database: D1Database) {
  return [
    database
      .prepare(`INSERT INTO company_employees (id, official_name, created_at, updated_at)
      VALUES (?1, 'Example Person', 0, 0)`)
      .bind(employeeId),
    database
      .prepare(`INSERT INTO company_employments
      (id, employee_id, contract_name, employment_type, hire_date, status, termination_date, created_at, updated_at)
      VALUES (?1, ?2, 'Example Person', 'FULL_TIME', '2026-09-01', 'ACTIVE', NULL, 0, 0)`)
      .bind(employmentId, employeeId),
  ]
}

describe("新規雇用と初期の期間履歴の原子性", () => {
  test("両製品のmigrationから作成し、入社日の境界でアクセスが有効になる", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    await database.batch([...employeeStatements(database), ...(await prepare(database))])
    const resolve = (now: string) =>
      new ResolveLiveEmployeeAccessAdapter({
        env: {
          DB: database,
          COMPANY_TIME_ZONE: "Asia/Tokyo",
          NOW: now,
        },
      }).resolveLiveEmployeeAccess(employeeId)
    expect(await resolve("2026-08-31T14:59:59Z")).toBeNull()
    expect(await resolve("2026-08-31T15:00:00Z")).toMatchObject({ status: "ACTIVE" })
    const action = await database
      .prepare(
        "SELECT summary_json, payload_fingerprint, source_type FROM company_personnel_actions WHERE employee_id = ?1",
      )
      .bind(employeeId)
      .first<{ summary_json: string; payload_fingerprint: string; source_type: string }>()
    if (action === null) throw new Error("missing initial action")
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(action.summary_json),
    )
    expect(action.payload_fingerprint).toBe(
      [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    )
    expect(action.source_type).toBe("system")
    expect(JSON.parse(action.summary_json)).toMatchObject({
      status: "active",
      reason: input.reason,
    })
  })

  test("期間履歴の保存失敗で雇用と従業員もrollbackする", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    await database.exec(
      "CREATE TRIGGER reject_initial_status BEFORE INSERT ON company_employee_status_period_versions BEGIN SELECT RAISE(ABORT, 'status unavailable'); END;",
    )
    const failure = await database
      .batch([...employeeStatements(database), ...(await prepare(database))])
      .catch((cause: unknown) => cause)
    expect(failure).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT id FROM company_employees WHERE id = ?1")
        .bind(employeeId)
        .first(),
    ).toBeNull()
    expect(
      await database
        .prepare("SELECT id FROM company_personnel_actions WHERE employee_id = ?1")
        .bind(employeeId)
        .first(),
    ).toBeNull()
  })

  test("初期履歴の二重作成を拒否し、同じbatch内の先行更新も戻す", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    await database.batch([...employeeStatements(database), ...(await prepare(database))])
    const failure = await database
      .batch([
        database
          .prepare("UPDATE company_employees SET official_name = 'Should roll back' WHERE id = ?1")
          .bind(employeeId),
        ...(await prepare(database)),
      ])
      .catch((cause: unknown) => cause)
    expect(failure).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT official_name FROM company_employees WHERE id = ?1")
        .bind(employeeId)
        .first<string>("official_name"),
    ).toBe("Example Person")
    expect(
      await database
        .prepare("SELECT count(*) AS total FROM company_personnel_actions WHERE employee_id = ?1")
        .bind(employeeId)
        .first<number>("total"),
    ).toBe(1)
  })

  test("存在しない雇用を事実として初期化しない", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    const failure = await database
      .batch([...(await prepare(database))])
      .catch((cause: unknown) => cause)
    expect(failure).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT id FROM company_personnel_actions WHERE employee_id = ?1")
        .bind(employeeId)
        .first(),
    ).toBeNull()
  })

  test("入社日と状態が一致しない既存雇用から履歴を推測しない", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    await database.batch(employeeStatements(database))
    await database
      .prepare(
        "UPDATE company_employments SET hire_date = '2026-01-01', status = 'ON_LEAVE' WHERE id = ?1",
      )
      .bind(employmentId)
      .run()
    const failure = await database
      .batch([...(await prepare(database))])
      .catch((cause: unknown) => cause)
    expect(failure).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT period_id FROM company_employment_period_versions WHERE employee_id = ?1")
        .bind(employeeId)
        .first(),
    ).toBeNull()
  })

  test("理由や記録日時が無効ならstatementを作らない", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    const adapter = new InitialEmploymentPersistenceAdapter({
      env: { DB: database },
      var: { database: drizzle(database) },
    })
    expect(await adapter.prepare({ ...input, status: "active", reason: " " })).toBeInstanceOf(Error)
    expect(
      await adapter.prepare({ ...input, status: "active", occurredAt: new Date("invalid") }),
    ).toBeInstanceOf(Error)
  })
})
