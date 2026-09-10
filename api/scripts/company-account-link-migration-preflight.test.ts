import { afterEach, describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { CompanyAccountLinkMigrationPreflight } from "./company-account-link-migration-preflight"

const migrationsDirectory = fileURLToPath(new URL("../migrations", import.meta.url))
const validation = "0154_validate_existing_company_account_links.sql"
const binding = "0147_bind_company_account_employee_resources.sql"
const workforce = "0081_bind_company_workforce_resources.sql"
const databases: Database[] = []
const zeroCounts = {
  unconnected_resource_links: 0,
  unconnected_bound_links: 0,
  invalid_link_periods: 0,
  identity_conflicts: 0,
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

function failureMessage(value: unknown): string {
  if (!(value instanceof Error)) throw new Error("Expected a migration preparation failure")
  return value.message
}

function createDatabase(): Database {
  const database = new Database(":memory:")
  databases.push(database)
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE system_accounts (id TEXT PRIMARY KEY);
    CREATE TABLE company_employees (id TEXT PRIMARY KEY);
    CREATE TABLE company_account_employee_links (account_id TEXT UNIQUE, employee_id TEXT UNIQUE);
    CREATE TABLE company_workforce_resource_bindings (
      organization_id TEXT, resource_type TEXT, resource_id TEXT
    );
    CREATE TABLE company_resource_heads (
      organization_id TEXT, resource_type TEXT, resource_id TEXT, attributes_json TEXT,
      updated_at INTEGER, PRIMARY KEY (organization_id, resource_type, resource_id)
    );
    CREATE TABLE company_resource_revisions (
      organization_id TEXT, resource_type TEXT, resource_id TEXT, attributes_json TEXT,
      revision INTEGER, organization_revision INTEGER, effective_from TEXT, effective_to TEXT,
      state TEXT, PRIMARY KEY (organization_id, resource_type, resource_id, revision)
    );
    INSERT INTO system_accounts VALUES ('account:one');
    INSERT INTO system_accounts VALUES ('account:two');
    INSERT INTO company_employees VALUES ('employee:one');
    INSERT INTO company_employees VALUES ('employee:two');
  `)
  return database
}

function addResource(
  database: Database,
  props: {
    type: string
    id: string
    startsOn: string
    endsOn?: string | null
    revision?: number
    state?: string
    accountId?: string
    employeeId?: string
  },
): void {
  const attributes = JSON.stringify({
    accountId: props.accountId ?? "account:one",
    employeeId: props.employeeId ?? "employee:one",
  })
  database.run(
    `INSERT INTO company_resource_heads VALUES (?, ?, ?, ?, 0)
    ON CONFLICT DO UPDATE SET attributes_json = excluded.attributes_json`,
    ["organization:default", props.type, props.id, attributes],
  )
  database.run("INSERT INTO company_resource_revisions VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)", [
    "organization:default",
    props.type,
    props.id,
    attributes,
    props.revision ?? 1,
    props.startsOn,
    props.endsOn ?? null,
    props.state ?? "active",
  ])
}

function addConnectedEmployee(database: Database): void {
  addResource(database, { type: "employee", id: "employee:one", startsOn: "2026-01-01" })
  database.run("INSERT INTO company_workforce_resource_bindings VALUES (?, ?, ?)", [
    "organization:default",
    "employee",
    "employee:one",
  ])
}

function applyMigration(database: Database, name: string): void {
  for (const statement of readFileSync(`${migrationsDirectory}/${name}`, "utf8").split(";")) {
    if (statement.trim() !== "") database.run(statement)
  }
}

async function inspect(database: Database, appliedNames: string[] = [workforce]) {
  const before = database.query("SELECT * FROM sqlite_master ORDER BY name").all()
  database.exec("PRAGMA query_only = ON")
  const readiness = await new CompanyAccountLinkMigrationPreflight({
    appliedNames,
    localNames: [validation],
    migrationsDirectory,
    query: async (sql) => database.query(sql).all(),
  }).check()
  expect(database.query("SELECT * FROM sqlite_master ORDER BY name").all()).toEqual(before)
  database.exec("PRAGMA query_only = OFF")
  return readiness
}

describe("Company account-link migration preflight", () => {
  test("空の既存基盤は追加の table・view を作らず通る", async () => {
    expect(await inspect(createDatabase())).toEqual(zeroCounts)
  })

  test("未接続を DDL 前に検知し、別の従業員や employment の binding で補完しない", async () => {
    const database = createDatabase()
    addResource(database, { type: "employee", id: "employee:one", startsOn: "2026-01-01" })
    addResource(database, { type: "account-employee-link", id: "link:one", startsOn: "2026-02-01" })
    database.exec(`INSERT INTO company_workforce_resource_bindings VALUES
      ('organization:default', 'employee', 'employee:two'),
      ('organization:default', 'employment', 'employee:one')`)
    const readiness = await inspect(database)
    expect(readiness).toBeInstanceOf(Error)
    expect(failureMessage(readiness)).toContain('"unconnected_resource_links":1')
    expect(failureMessage(readiness)).toContain('"unconnected_bound_links":1')
    applyMigration(database, binding)
    applyMigration(database, "0148_create_company_account_employee_link_periods.sql")
    applyMigration(database, "0153_create_company_account_link_period_violations.sql")
    expect(() => applyMigration(database, validation)).toThrow("CHECK constraint failed")
  })

  test("確認済み binding と期間は実際の後続 migration でも通る", async () => {
    const database = createDatabase()
    addConnectedEmployee(database)
    addResource(database, { type: "account-employee-link", id: "link:one", startsOn: "2026-02-01" })
    expect(await inspect(database)).toEqual(zeroCounts)
    applyMigration(database, binding)
    applyMigration(database, "0148_create_company_account_employee_link_periods.sql")
    applyMigration(database, "0153_create_company_account_link_period_violations.sql")
    expect(await inspect(database, [workforce, binding])).toEqual(zeroCounts)
    expect(() => applyMigration(database, validation)).not.toThrow()
  })

  test("途中まで適用済みの場合は、生成した仮 binding で実 binding を隠さない", async () => {
    const database = createDatabase()
    addConnectedEmployee(database)
    addResource(database, { type: "account-employee-link", id: "link:one", startsOn: "2026-02-01" })
    applyMigration(database, binding)
    database.run("DELETE FROM company_workforce_resource_bindings")
    const readiness = await inspect(database, [workforce, binding])
    expect(failureMessage(readiness)).toContain('"unconnected_bound_links":1')
  })

  test("既存の Account 対応と公開履歴の人物が違えば、コピー前に拒否する", async () => {
    const database = createDatabase()
    addConnectedEmployee(database)
    addResource(database, { type: "account-employee-link", id: "link:one", startsOn: "2026-02-01" })
    database.run(
      "INSERT INTO company_account_employee_links VALUES ('account:one', 'employee:two')",
    )
    const readiness = await inspect(database)
    expect(failureMessage(readiness)).toContain('"identity_conflicts":1')
    expect(database.query("SELECT employee_id FROM company_account_employee_links").get()).toEqual({
      employee_id: "employee:two",
    })
    expect(() => applyMigration(database, binding)).toThrow("CHECK constraint failed")
  })

  test("従業員の有効期間に空白があれば、リンクがその前後を覆っていても拒否する", async () => {
    const database = createDatabase()
    addConnectedEmployee(database)
    database.run("UPDATE company_resource_revisions SET effective_to = '2026-04-01'")
    addResource(database, {
      type: "employee",
      id: "employee:one",
      startsOn: "2026-05-01",
      revision: 2,
    })
    addResource(database, { type: "account-employee-link", id: "link:one", startsOn: "2026-02-01" })
    const readiness = await inspect(database)
    expect(failureMessage(readiness)).toContain('"invalid_link_periods":1')
    applyMigration(database, binding)
    applyMigration(database, "0148_create_company_account_employee_link_periods.sql")
    applyMigration(database, "0153_create_company_account_link_period_violations.sql")
    expect(() => applyMigration(database, validation)).toThrow("CHECK constraint failed")
  })

  test("連続する従業員の版を結合し、同日訂正は最新 revision だけを採る", async () => {
    const database = createDatabase()
    addConnectedEmployee(database)
    database.run("UPDATE company_resource_revisions SET effective_to = '2026-04-01'")
    addResource(database, {
      type: "employee",
      id: "employee:one",
      startsOn: "2026-04-01",
      revision: 2,
      state: "void",
    })
    addResource(database, {
      type: "employee",
      id: "employee:one",
      startsOn: "2026-04-01",
      revision: 3,
    })
    addResource(database, { type: "account-employee-link", id: "link:one", startsOn: "2026-02-01" })
    expect(await inspect(database)).toEqual(zeroCounts)
  })

  test("終了日は半開区間として比較し、同日の失効でリンクを閉じる", async () => {
    const database = createDatabase()
    addConnectedEmployee(database)
    database.run("UPDATE company_resource_revisions SET effective_to = '2026-04-01'")
    addResource(database, { type: "account-employee-link", id: "link:one", startsOn: "2026-02-01" })
    expect(failureMessage(await inspect(database))).toContain('"invalid_link_periods":1')
    addResource(database, {
      type: "account-employee-link",
      id: "link:one",
      startsOn: "2026-04-01",
      state: "void",
      revision: 2,
    })
    expect(await inspect(database)).toEqual(zeroCounts)
  })

  test("公開対応のない従来の Account 対応を、時点の推測で移行しない", async () => {
    const database = createDatabase()
    database.run(
      "INSERT INTO company_account_employee_links VALUES ('account:one', 'employee:one')",
    )
    expect(await inspect(database)).toEqual(zeroCounts)
  })

  test.each([
    { appliedNames: [workforce, validation], localNames: [validation] },
    { appliedNames: [workforce], localNames: [] },
  ])("対象が未適用でなければデータを読まない %j", async (names) => {
    const readiness = await new CompanyAccountLinkMigrationPreflight({
      ...names,
      migrationsDirectory,
      query: async () => {
        throw new Error("unexpected query")
      },
    }).check()
    expect(readiness).toBeNull()
  })

  test("前提 schema がない古い DB を検査済みとして通さない", async () => {
    const readiness = await new CompanyAccountLinkMigrationPreflight({
      appliedNames: [],
      localNames: [validation],
      migrationsDirectory,
      query: async () => {
        throw new Error("unexpected query")
      },
    }).check()
    expect(readiness).toBeInstanceOf(Error)
  })

  test.each([
    null,
    [],
    [zeroCounts, zeroCounts],
    [{}],
    [{ ...zeroCounts, invalid_link_periods: -1 }],
    [{ ...zeroCounts, invalid_link_periods: "0" }],
    [{ ...zeroCounts, invalid_link_periods: 0.5 }],
  ])("照会応答が不完全なら検査済みにしない %j", async (rows) => {
    const readiness = await new CompanyAccountLinkMigrationPreflight({
      appliedNames: [workforce],
      localNames: [validation],
      migrationsDirectory,
      query: async () => rows,
    }).check()
    expect(readiness).toBeInstanceOf(Error)
  })
})
