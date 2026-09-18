import { listSystemAccountInvitations } from "@system/interface/iam/list-system-account-invitations"
import { createSystemD1TestDatabase } from "@system/test/create-system-d1-test-database.test-support"
import { expect, test } from "bun:test"

const schema = `CREATE TABLE system_account_invitations (
  id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, subject TEXT, role_id TEXT NOT NULL,
  resource_type TEXT, resource_id TEXT, related_resource_id TEXT,
  accepted_by_account_id TEXT, expires_at INTEGER NOT NULL, revoked_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
)`

test("System招待一覧は未受諾の招待を新しい順に限定する", async () => {
  const database = createSystemD1TestDatabase(schema)
  for (const [id, createdAt, usedBy] of [
    ["old", 100, null],
    ["new", 200, null],
    ["used", 300, "account-1"],
  ] as const) {
    await database
      .prepare(
        `INSERT INTO system_account_invitations
         (id, token, role_id, accepted_by_account_id, expires_at, created_at, updated_at)
         VALUES (?1, ?1, 'role-1', ?2, 1000, ?3, ?3)`,
      )
      .bind(id, usedBy, createdAt)
      .run()
  }

  const rows = await listSystemAccountInvitations(database, 1)
  expect(rows).not.toBeInstanceOf(Error)
  if (rows instanceof Error) throw rows
  expect(rows.map((row) => row.id)).toEqual(["new"])
})
