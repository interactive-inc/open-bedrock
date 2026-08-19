import { ProvisionCompanyBootstrapEmployee } from "@/contexts/company/application/employee/provision-company-bootstrap-employee"
import { CompanyBootstrapEmployeeRepositoryD1 } from "@/contexts/company/infrastructure/employee/company-bootstrap-employee-repository"
import { zAccountId } from "@system/domain/auth/account-id"
import { wrapSystemD1TestDatabase } from "@system/infrastructure/auth/system-d1-test-database.test-support"
import { Database } from "bun:sqlite"
import { afterEach, describe, expect, test } from "bun:test"

const accountId = zAccountId.parse("account-root")
const databases: Database[] = []

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

function createFixture(): {
  application: ProvisionCompanyBootstrapEmployee
  database: Database
} {
  const database = new Database(":memory:")
  databases.push(database)
  database.run("PRAGMA foreign_keys = ON")
  database.exec(`
    CREATE TABLE system_accounts (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL,
      token_version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE employees (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE account_employee_links (
      account_id TEXT PRIMARY KEY NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
      employee_id INTEGER NOT NULL UNIQUE REFERENCES employees(id) ON DELETE RESTRICT
    );
    CREATE TABLE company_organizations (
      id TEXT PRIMARY KEY NOT NULL
    );
    CREATE TABLE company_account_profiles (
      organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (organization_id, account_id)
    );
    INSERT INTO company_organizations VALUES ('organization:default');
    INSERT INTO system_accounts VALUES ('account-root', 'active', 0, 0, 0);
  `)
  const repository = new CompanyBootstrapEmployeeRepositoryD1({
    env: { DB: wrapSystemD1TestDatabase(database) },
  })

  return {
    application: new ProvisionCompanyBootstrapEmployee({ repository }),
    database,
  }
}

function command() {
  return { accountId, employeeCode: " ROOT ", name: " Initial Admin ", now: new Date(100) }
}

describe("Company bootstrap Employee", () => {
  test("System tableを変更せず最初のEmployeeとAccount linkだけを作る", async () => {
    const { application, database } = createFixture()

    const result = await application.execute(command())

    expect(result).not.toBeInstanceOf(Error)
    expect(result).toMatchObject({ kind: "created", state: "complete" })
    if (result instanceof Error || result.kind !== "created" || result.employeeId === null) {
      throw new Error("Company bootstrap failed")
    }
    expect(
      database
        .query(
          `SELECT employee.code, employee.name, employee.status, link.account_id
           FROM employees employee
           INNER JOIN account_employee_links link ON link.employee_id = employee.id
           WHERE employee.id = ?1`,
        )
        .get(result.employeeId),
    ).toEqual({
      code: "ROOT",
      name: "Initial Admin",
      status: "active",
      account_id: "account-root",
    })
    expect(database.query("SELECT COUNT(*) AS count FROM system_accounts").get()).toEqual({
      count: 1,
    })
    expect(
      database.query("SELECT account_id, display_name FROM company_account_profiles").get(),
    ).toEqual({ account_id: "account-root", display_name: "Initial Admin" })
  })

  test("再実行と同時実行でEmployeeとlinkを増殖させない", async () => {
    const first = createFixture()
    const created = await first.application.execute(command())
    const retried = await first.application.execute(command())
    expect(created).not.toBeInstanceOf(Error)
    if (created instanceof Error || !("employeeId" in created) || created.employeeId === null) {
      throw new Error("Company bootstrap failed")
    }
    expect(retried).toEqual({
      kind: "already_initialized",
      employeeId: created.employeeId,
      state: "complete",
    })

    const second = createFixture()
    const concurrent = await Promise.all([
      second.application.execute(command()),
      second.application.execute(command()),
    ])
    expect(
      concurrent.filter((result) => !(result instanceof Error) && result.kind === "created"),
    ).toHaveLength(1)
    expect(
      concurrent.filter(
        (result) => !(result instanceof Error) && result.kind === "already_initialized",
      ),
    ).toHaveLength(1)
    expect(second.database.query("SELECT COUNT(*) AS count FROM employees").get()).toEqual({
      count: 1,
    })
    expect(
      second.database.query("SELECT COUNT(*) AS count FROM account_employee_links").get(),
    ).toEqual({ count: 1 })
    expect(
      second.database.query("SELECT COUNT(*) AS count FROM company_account_profiles").get(),
    ).toEqual({ count: 1 })
  })

  test("既存Companyが別にある不完全環境へroot Employeeを追加しない", async () => {
    const { application, database } = createFixture()
    database.run("INSERT INTO employees (code, name, status) VALUES ('E001', 'Existing', 'active')")

    expect(await application.execute(command())).toEqual({
      kind: "already_initialized",
      employeeId: null,
      state: "company_exists_without_account_link",
    })
    expect(database.query("SELECT COUNT(*) AS count FROM employees").get()).toEqual({ count: 1 })
    expect(database.query("SELECT COUNT(*) AS count FROM account_employee_links").get()).toEqual({
      count: 0,
    })
  })

  test("link保存失敗はEmployeeもrollbackし不正入力は永続化前に拒否する", async () => {
    const first = createFixture()
    first.database.exec(`
      CREATE TRIGGER reject_company_link
      BEFORE INSERT ON account_employee_links
      BEGIN
        SELECT RAISE(ABORT, 'link unavailable');
      END;
    `)
    expect(await first.application.execute(command())).toBeInstanceOf(Error)
    expect(first.database.query("SELECT COUNT(*) AS count FROM employees").get()).toEqual({
      count: 0,
    })

    const second = createFixture()
    expect(await second.application.execute({ ...command(), name: "\0" })).toEqual({
      kind: "invalid_input",
    })
    expect(second.database.query("SELECT COUNT(*) AS count FROM employees").get()).toEqual({
      count: 0,
    })
  })
})
