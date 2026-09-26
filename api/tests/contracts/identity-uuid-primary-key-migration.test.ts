import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0342_convert_identity_ids_to_uuid.sql"

test("整数の Account と社員を UUID に置き換え、参照と legacy_id を追従させる", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "system_accounts",
      "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('7', 'active', 0, 0, 0)",
    )
    insertBypassingGuards(
      database,
      "system_principals",
      "INSERT INTO system_principals (id, account_id, kind, name, revision, created_at, updated_at) VALUES ('principal:7', '7', 'human', 'x', 1, 0, 0)",
    )
    insertBypassingGuards(
      database,
      "company_employees",
      "INSERT INTO company_employees (id, official_name, employee_code, created_at, updated_at) VALUES ('7', 'x', 'E007', 0, 0)",
    )
    insertBypassingGuards(
      database,
      "company_account_employee_links",
      "INSERT INTO company_account_employee_links (account_id, employee_id) VALUES ('7', '7')",
    )
    const violationsBefore = database.query("PRAGMA foreign_key_check").all().length

    applyMigration(database, TARGET)

    const account = database
      .query<{ id: string }, []>("SELECT id FROM system_accounts WHERE legacy_id = '7'")
      .get()
    const employee = database
      .query<{ id: string }, []>("SELECT id FROM company_employees WHERE legacy_id = '7'")
      .get()
    expect(isUuid(account?.id) && isUuid(employee?.id)).toBe(true)
    expect(account?.id).not.toBe(employee?.id)
    expect(
      database.query("SELECT account_id, employee_id FROM company_account_employee_links").get(),
    ).toEqual({ account_id: account?.id, employee_id: employee?.id })
    const principal = database
      .query<{ id: string; account_id: string; legacy_id: string }, []>(
        "SELECT id, account_id, legacy_id FROM system_principals WHERE legacy_id = 'principal:7'",
      )
      .get()
    expect(isUuid(principal?.id)).toBe(true)
    expect(principal?.account_id).toBe(account?.id)
    expect(database.query("PRAGMA foreign_key_check").all()).toHaveLength(violationsBefore)
    expect(() =>
      database.run(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('8', 'active', 0, 0, 0)",
      ),
    ).toThrow("CHECK constraint failed")
    expect(
      database
        .query(
          "SELECT name FROM sqlite_master WHERE name LIKE '\\_%' ESCAPE '\\' OR name LIKE '\\_\\_new\\_%' ESCAPE '\\'",
        )
        .all(),
    ).toEqual([])
  } finally {
    database.close()
  }
})

test("原記録の書込み停止中なら止める", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "system_record_source_freezes",
      `INSERT INTO system_record_source_freezes (id, source_namespace, owner_context, revision, created_audit_event_id, snapshot_json)
       VALUES ('${crypto.randomUUID()}', 'ns', 'company', 1, '${crypto.randomUUID()}', '{}')`,
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})
