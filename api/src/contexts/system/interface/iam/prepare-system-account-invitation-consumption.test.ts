import { prepareSystemAccountInvitationConsumption } from "@system/interface/iam/prepare-system-account-invitation-consumption"
import { createSystemD1TestDatabase } from "@system/test/create-system-d1-test-database.test-support"
import { expect, test } from "bun:test"
import { sql } from "drizzle-orm"

const schema = `
  CREATE TABLE system_iam_roles (id TEXT PRIMARY KEY, resource_type TEXT, updated_at INTEGER NOT NULL);
  CREATE TABLE system_account_invitations (
    id TEXT PRIMARY KEY, token TEXT NOT NULL, subject TEXT, role_id TEXT NOT NULL,
    accepted_by_account_id TEXT, expires_at INTEGER NOT NULL, revoked_at INTEGER,
    updated_at INTEGER NOT NULL
  );
  INSERT INTO system_iam_roles VALUES ('role-1', NULL, 100);
  INSERT INTO system_account_invitations VALUES
    ('invite-1', 'digest-1', 'person@example.com', 'role-1', NULL, 1000, NULL, 100),
    ('invite-2', 'digest-2', 'person@example.com', 'role-1', NULL, 1000, NULL, 100);
`

test("System招待受諾はsnapshotと追加条件が一致するときだけ更新する", async () => {
  const database = createSystemD1TestDatabase(schema)
  const prepare = (id: string, storedToken: string, additionalConditions = [sql`1 = 1`]) =>
    prepareSystemAccountInvitationConsumption(database, {
      id,
      storedToken,
      expectedEmail: "person@example.com",
      roleId: "role-1",
      expectedUpdatedAt: new Date(100),
      expectedExpiresAt: new Date(1000),
      expectedRoleUpdatedAt: new Date(100),
      expectedRoleResourceType: null,
      acceptedByAccountId: "account-1",
      consumedAt: new Date(200),
      additionalConditions,
    })

  const denied = prepare("invite-1", "digest-1", [sql`1 = 0`])
  if (denied instanceof Error) throw denied
  await denied.run()
  expect(
    await database
      .prepare(
        "SELECT accepted_by_account_id FROM system_account_invitations WHERE id = 'invite-1'",
      )
      .first<{ accepted_by_account_id: string | null }>(),
  ).toEqual({ accepted_by_account_id: null })

  const consumed = prepare("invite-1", "digest-1")
  if (consumed instanceof Error) throw consumed
  await consumed.run()
  expect(
    await database
      .prepare(
        "SELECT accepted_by_account_id FROM system_account_invitations WHERE id = 'invite-1'",
      )
      .first<{ accepted_by_account_id: string | null }>(),
  ).toEqual({ accepted_by_account_id: "account-1" })

  await database.prepare("UPDATE system_iam_roles SET updated_at = 201 WHERE id = 'role-1'").run()
  const stale = prepare("invite-2", "digest-2")
  if (stale instanceof Error) throw stale
  await stale.run()
  expect(
    await database
      .prepare(
        "SELECT accepted_by_account_id FROM system_account_invitations WHERE id = 'invite-2'",
      )
      .first<{ accepted_by_account_id: string | null }>(),
  ).toEqual({ accepted_by_account_id: null })
})
