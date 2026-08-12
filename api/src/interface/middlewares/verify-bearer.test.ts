import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { describe, expect, test } from "bun:test"

const jwtSecret = "lifecycle-verify-bearer-test-secret"

async function database(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
  await db.exec(`
    INSERT INTO employees (id, code, name, status, archived_at) VALUES
      (1, 'E001', 'Fixture Active', 'retired', NULL),
      (2, 'E002', 'Fixture Leave', 'retired', NULL),
      (3, 'E003', 'Fixture Prehire', 'active', NULL),
      (4, 'E004', 'Fixture Retiring', 'active', NULL),
      (5, 'E005', 'Fixture Archived', 'active', 1);
    INSERT INTO employment_period_versions
      (period_id, revision, employee_id, starts_on, ends_on, is_void,
       recorded_by_action_id, recorded_at) VALUES
      ('employment-1', 1, 1, '2026-01-01', NULL, 0, 'fixture', 1),
      ('employment-2', 1, 2, '2026-01-01', NULL, 0, 'fixture', 1),
      ('employment-3', 1, 3, '2026-07-01', NULL, 0, 'fixture', 1),
      ('employment-4', 1, 4, '2026-01-01', '2026-06-02', 0, 'fixture', 1),
      ('employment-5', 1, 5, '2026-01-01', NULL, 0, 'fixture', 1);
    INSERT INTO employee_status_period_versions
      (period_id, revision, employment_period_id, employee_id, status, starts_on,
       ends_on, is_void, recorded_by_action_id, recorded_at) VALUES
      ('status-1', 1, 'employment-1', 1, 'active', '2026-01-01', NULL, 0, 'fixture', 1),
      ('status-2', 1, 'employment-2', 2, 'leave', '2026-01-01', NULL, 0, 'fixture', 1),
      ('status-3', 1, 'employment-3', 3, 'active', '2026-07-01', NULL, 0, 'fixture', 1),
      ('status-4', 1, 'employment-4', 4, 'active', '2026-01-01', '2026-06-02', 0, 'fixture', 1),
      ('status-5', 1, 'employment-5', 5, 'active', '2026-01-01', NULL, 0, 'fixture', 1);
    UPDATE lifecycle_migration_states SET status = 'verified' WHERE id = 1;
  `)
  await seedIamForEmployees(
    db,
    [1, 2, 3, 4, 5].map((id) => ({
      id,
      email: `you+e00${id}@example.com`,
      passwordHash: "fixture",
      role: id === 1 ? "root" : "member",
    })),
  )
  return db
}

async function me(props: {
  db: D1Database
  employeeId: number
  now?: string
  companyTimeZone?: string
}): Promise<Response> {
  return requestWithContext({
    db: props.db,
    jwtSecret,
    path: "/me",
    token: await createTestToken(jwtSecret, { employeeId: props.employeeId }),
    now: props.now ?? "2026-06-01T00:00:00.000Z",
    companyTimeZone: props.companyTimeZone,
  })
}

describe("verifyBearer lifecycle status", () => {
  test("allows derived active and leave even when legacy employee.status is stale", async () => {
    const db = await database()
    expect((await me({ db, employeeId: 1 })).status).toBe(200)
    expect((await me({ db, employeeId: 2 })).status).toBe(200)
  })

  test("denies prehire, retired, and archived employees", async () => {
    const db = await database()
    expect((await me({ db, employeeId: 3 })).status).toBe(401)
    expect((await me({ db, employeeId: 4, now: "2026-06-02T00:00:00.000Z" })).status).toBe(401)
    expect((await me({ db, employeeId: 5 })).status).toBe(401)
  })

  test("denies suspended and locked Accounts with the same public 401 response", async () => {
    const responses: Array<{ status: number; body: string }> = []

    for (const accountStatus of ["suspended", "locked"]) {
      const db = await database()
      await db
        .prepare(
          `UPDATE accounts
           SET status = ?1,
               token_version = token_version + 1,
               updated_at = updated_at + 1
           WHERE id = (
             SELECT account_id FROM account_employee_links WHERE employee_id = 1
           )`,
        )
        .bind(accountStatus)
        .run()

      const response = await me({ db, employeeId: 1 })
      responses.push({ status: response.status, body: await response.text() })
    }

    expect(responses).toEqual([
      { status: 401, body: '{"error":"account is not active"}' },
      { status: 401, body: '{"error":"account is not active"}' },
    ])
  })

  test("denies a locked canonical Account when the legacy Account remains active", async () => {
    const db = await database()
    await db.exec(`
      UPDATE system_accounts
      SET status = 'locked', token_version = token_version + 1, updated_at = updated_at + 1
      WHERE id = (
        SELECT CAST(account_id AS TEXT) FROM account_employee_links WHERE employee_id = 1
      );
    `)

    const response = await me({ db, employeeId: 1 })

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('{"error":"account is not active"}')
  })

  test("denies a missing canonical Account instead of falling back to legacy", async () => {
    const db = await database()
    await db.exec(`
      DELETE FROM system_accounts
      WHERE id = (
        SELECT CAST(account_id AS TEXT) FROM account_employee_links WHERE employee_id = 1
      );
    `)

    const response = await me({ db, employeeId: 1 })

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('{"error":"account not found"}')
  })

  test("denies a corrupt canonical Account", async () => {
    const db = await database()
    await db.exec(`
      PRAGMA ignore_check_constraints = ON;
      UPDATE system_accounts
      SET status = 'invalid', token_version = token_version + 1, updated_at = updated_at + 1
      WHERE id = (
        SELECT CAST(account_id AS TEXT) FROM account_employee_links WHERE employee_id = 1
      );
    `)

    const response = await me({ db, employeeId: 1 })

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('{"error":"account authentication is unavailable"}')
  })

  test("denies a canonical Account query failure", async () => {
    const db = await database()
    await db.exec("DROP TABLE system_accounts")

    const response = await me({ db, employeeId: 1 })

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('{"error":"account authentication is unavailable"}')
  })

  test("denies a canonical token version mismatch when legacy still permits the token", async () => {
    const db = await database()
    await db.exec(`
      UPDATE system_accounts
      SET token_version = token_version + 1, updated_at = updated_at + 1
      WHERE id = (
        SELECT CAST(account_id AS TEXT) FROM account_employee_links WHERE employee_id = 1
      );
    `)

    const response = await me({ db, employeeId: 1 })

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('{"error":"token has been revoked"}')
  })

  test("switches at the company date boundary and fails closed for an unknown time zone", async () => {
    const db = await database()
    expect((await me({ db, employeeId: 4, now: "2026-06-01T14:59:59.000Z" })).status).toBe(200)
    expect((await me({ db, employeeId: 4, now: "2026-06-01T15:00:00.000Z" })).status).toBe(401)
    expect((await me({ db, employeeId: 1, companyTimeZone: "Invalid/Zone" })).status).toBe(401)
  })
})
