import { expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { InitialAccountEmploymentStatementAdapter } from "@/contexts/company/infrastructure/adapters/employee/initial-account-employment-statement.adapter"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

function fixture() {
  return createCompanyD1TestDatabase(`
    CREATE TABLE company_employees (
      id text PRIMARY KEY, official_name text NOT NULL, employee_code text,
      email text, phone text, created_at integer NOT NULL, updated_at integer NOT NULL
    );
    CREATE TABLE company_employments (
      id text PRIMARY KEY, employee_id text NOT NULL, contract_name text NOT NULL,
      employment_type text NOT NULL, hire_date text NOT NULL, status text NOT NULL,
      termination_date text, created_at integer NOT NULL, updated_at integer NOT NULL
    );
    CREATE TABLE company_account_employee_links (
      account_id text PRIMARY KEY, employee_id text NOT NULL UNIQUE
    );
    CREATE TABLE company_account_profiles (
      organization_id text NOT NULL, account_id text NOT NULL,
      display_name text NOT NULL, updated_at integer NOT NULL,
      PRIMARY KEY (organization_id, account_id)
    );
    INSERT INTO company_account_profiles VALUES
      ('organization:default', 'account:1', '招待時の名前', 0);
  `)
}

function statements(database: D1Database, officialName: string, createLink: boolean) {
  const built = new InitialAccountEmploymentStatementAdapter(drizzle(database)).build({
    accountId: "account:1",
    employeeId: "employee:1",
    employmentId: "employment:1",
    createAccountEmployeeLink: createLink,
    officialName,
    employmentType: "FULL_TIME",
    hireDate: "2026-04-01",
    status: "ACTIVE",
    now: new Date("2026-09-17T00:00:00Z"),
  })
  return built.map((statement) => {
    const query = statement.toSQL()
    return database.prepare(query.sql).bind(...query.params)
  })
}

test("Company初期雇用とAccount対応を同じbatchに置き、表示名を確定氏名へ揃える", async () => {
  const database = fixture()
  await database.batch(statements(database, "職員 花子", true))
  expect(
    await database
      .prepare("SELECT official_name FROM company_employees")
      .first<{ official_name: string }>(),
  ).toEqual({ official_name: "職員 花子" })
  expect(
    await database
      .prepare("SELECT contract_name FROM company_employments")
      .first<{ contract_name: string }>(),
  ).toEqual({ contract_name: "職員 花子" })
  expect(
    await database
      .prepare("SELECT display_name FROM company_account_profiles")
      .first<{ display_name: string }>(),
  ).toEqual({ display_name: "職員 花子" })
})

test("既存従業員へ異なる氏名の雇用を追加しても更新せずbatchを戻す", async () => {
  const database = fixture()
  await database
    .prepare(
      "INSERT INTO company_employees VALUES ('employee:1', '元の氏名', NULL, NULL, NULL, 0, 0)",
    )
    .run()
  const failure = await database
    .batch(statements(database, "別の氏名", false))
    .catch((cause: unknown) => cause)
  expect(failure).toBeInstanceOf(Error)
  expect(
    await database
      .prepare("SELECT count(*) AS count FROM company_employments")
      .first<{ count: number }>(),
  ).toEqual({ count: 0 })
  expect(
    await database
      .prepare("SELECT official_name FROM company_employees")
      .first<{ official_name: string }>(),
  ).toEqual({ official_name: "元の氏名" })
})
