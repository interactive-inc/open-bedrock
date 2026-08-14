import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const migrationSql = readFileSync(
  join(import.meta.dir, "../../../../../migrations/0123_account_employee_links.sql"),
  "utf8",
)

describe("0123 account employee links", () => {
  test("preserves account and login state while removing Company columns from System tables", () => {
    const database = new Database(":memory:")
    database.exec(`
      CREATE TABLE employees (
        id INTEGER PRIMARY KEY,
        code TEXT,
        name TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY,
        employee_id INTEGER,
        status TEXT NOT NULL,
        token_version INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX uniq_accounts_employee
        ON accounts (employee_id) WHERE employee_id IS NOT NULL;
      CREATE TABLE cli_login_codes (
        code_hash TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX idx_cli_login_codes_expires ON cli_login_codes (expires_at);
      CREATE TABLE browser_login_codes (
        code_hash TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX idx_browser_login_codes_expires ON browser_login_codes (expires_at);
      CREATE TABLE roles (
        id INTEGER PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE permissions (
        id INTEGER PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        category TEXT NOT NULL
      );
      CREATE TABLE role_permissions (
        role_id INTEGER NOT NULL,
        permission_id INTEGER NOT NULL,
        PRIMARY KEY (role_id, permission_id)
      );
      INSERT INTO roles (id, key, name, is_system, created_at)
      VALUES (1, 'root', 'System Administrator', 1, 0);
      INSERT INTO employees (id, code, name, status)
      VALUES (10, 'E010', 'Linked Employee', 'active');
      INSERT INTO accounts (id, employee_id, status, token_version, created_at, updated_at)
      VALUES
        (1, 10, 'active', 3, 100, 200),
        (2, NULL, 'suspended', 4, 300, 400);
      INSERT INTO cli_login_codes (code_hash, account_id, employee_id, expires_at)
      VALUES ('one-time-code', 1, 10, 500);
      INSERT INTO browser_login_codes (code_hash, account_id, employee_id, expires_at)
      VALUES ('browser-code', 1, 10, 600);
    `)

    database.exec(migrationSql)

    const accountColumns = database
      .query<{ name: string }, []>("PRAGMA table_info(accounts)")
      .all()
      .map((column) => String(column.name))
    const cliCodeColumns = database
      .query<{ name: string }, []>("PRAGMA table_info(cli_login_codes)")
      .all()
      .map((column) => String(column.name))
    const browserCodeColumns = database
      .query<{ name: string }, []>("PRAGMA table_info(browser_login_codes)")
      .all()
      .map((column) => String(column.name))
    const links = database.query("SELECT account_id, employee_id FROM account_employee_links").all()
    const accounts = database
      .query("SELECT id, status, token_version, created_at, updated_at FROM accounts ORDER BY id")
      .all()
    const cliCodes = database
      .query("SELECT code_hash, account_id, expires_at FROM cli_login_codes")
      .all()
    const browserCodes = database
      .query("SELECT code_hash, account_id, expires_at FROM browser_login_codes")
      .all()
    const rootPermissions = database
      .query<{ key: string }, []>(
        `SELECT permission.key
         FROM role_permissions grant_record
         JOIN permissions permission ON permission.id = grant_record.permission_id
         WHERE grant_record.role_id = 1
         ORDER BY permission.key`,
      )
      .all()
      .map((permission) => permission.key)

    expect(accountColumns).not.toContain("employee_id")
    expect(cliCodeColumns).not.toContain("employee_id")
    expect(browserCodeColumns).not.toContain("employee_id")
    expect(links).toEqual([{ account_id: 1, employee_id: 10 }])
    expect(accounts).toEqual([
      { id: 1, status: "active", token_version: 3, created_at: 100, updated_at: 200 },
      { id: 2, status: "suspended", token_version: 4, created_at: 300, updated_at: 400 },
    ])
    expect(cliCodes).toEqual([{ code_hash: "one-time-code", account_id: 1, expires_at: 500 }])
    expect(browserCodes).toEqual([{ code_hash: "browser-code", account_id: 1, expires_at: 600 }])
    expect(rootPermissions).toEqual(["iam:read", "iam:write", "system:admin"])

    database.close()
  })
})
