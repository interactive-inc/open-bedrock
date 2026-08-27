import { systemCoreSchema } from "@/contexts/system/infrastructure/schema/system-core"
import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { getTableConfig } from "drizzle-orm/sqlite-core"

const migrationsDirectory = join(import.meta.dir, "../../migrations")
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort()

function applyMigrations(database: Database, files: readonly string[]): void {
  for (const file of files) {
    database.exec(readFileSync(join(migrationsDirectory, file), "utf8"))
  }
}

test("released migrations preserve data and match the canonical System schema", () => {
  const database = new Database(":memory:")
  database.exec("PRAGMA foreign_keys = ON")

  applyMigrations(database, migrationFiles.slice(0, 7))
  database.exec(`
    INSERT INTO system_accounts
      (id, status, token_version, created_at, updated_at)
    VALUES ('account-existing', 'active', 0, 100, 100);

    INSERT INTO system_identity_bindings
      (id, account_id, provider, subject, created_at, activated_at)
    VALUES ('identity-existing', 'account-existing', 'password', 'existing@example.test', 100, 100);

    INSERT INTO system_identity_profiles
      (identity_id, email, email_verified, updated_at)
    VALUES ('identity-existing', 'existing@example.test', 1, 100);

    INSERT INTO system_notification_messages
      (id, kind, title, created_at)
    VALUES ('message-existing', 'system:test', 'Existing', 100);
  `)

  applyMigrations(database, migrationFiles.slice(7))

  expect(
    database.query("SELECT id, closed_at FROM system_accounts WHERE id = 'account-existing'").get(),
  ).toEqual({ id: "account-existing", closed_at: null })
  expect(
    database
      .query(
        "SELECT identity_id, can_receive_email FROM system_identity_profiles WHERE identity_id = 'identity-existing'",
      )
      .get(),
  ).toEqual({ identity_id: "identity-existing", can_receive_email: 1 })
  expect(
    database
      .query(
        "SELECT id, action_url, priority, dedupe_key FROM system_notification_messages WHERE id = 'message-existing'",
      )
      .get(),
  ).toEqual({ id: "message-existing", action_url: null, priority: "normal", dedupe_key: null })

  for (const declaration of Object.values(systemCoreSchema)) {
    const table = getTableConfig(declaration)
    const actualColumns = database
      .query<{ name: string }, []>(`PRAGMA table_info(${table.name})`)
      .all()
      .map((column) => column.name)

    expect(actualColumns.toSorted()).toEqual(table.columns.map((column) => column.name).toSorted())
  }

  expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
  database.close()
})
