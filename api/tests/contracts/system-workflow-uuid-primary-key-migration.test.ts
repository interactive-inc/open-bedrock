import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0339_enforce_system_workflow_uuid_primary_keys.sql"
const ACCOUNT = "5e0f7c3a-1d2b-4c5d-8e6f-000000000001"
const UUID_ROLE = "5e0f7c3a-1d2b-4c5d-8e6f-000000000002"

/** 新しい UUID の主キーを足した table。旧来の主キーは一意な属性として残る。 */
const SURROGATE_TABLES = [
  "system_procedure_definitions",
  "system_procedure_definition_revisions",
  "system_decision_tasks",
  "system_decision_task_candidates",
  "system_decision_task_exclusions",
  "system_iam_role_permissions",
] as const

function dependents(database: Database) {
  return database
    .query<{ entry: string }, []>(
      `SELECT type || ':' || tbl_name || ':' || name || ':' || sql AS entry FROM sqlite_master
       WHERE type IN ('index', 'trigger') AND tbl_name LIKE 'system\\_%' ESCAPE '\\' AND sql IS NOT NULL`,
    )
    .all()
    .map((row) => row.entry)
}

function seed(database: Database) {
  insertBypassingGuards(
    database,
    "system_iam_roles",
    `INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES
       ('101', 'test:member', 'custom', 'member', 1, 1),
       ('104', 'test:root', 'custom', 'root', 1, 1),
       ('${UUID_ROLE}', 'test:custom', 'custom', 'custom', 1, 1)`,
  )
  insertBypassingGuards(
    database,
    "system_iam_role_permissions",
    `INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES
       ('104', 'test:admin'), ('101', 'test:read'), ('${UUID_ROLE}', 'test:read')`,
  )
  insertBypassingGuards(
    database,
    "system_role_bindings",
    `INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES
       ('recovery-root', '${ACCOUNT}', '104', 1)`,
  )
  insertBypassingGuards(
    database,
    "system_account_invitations",
    `INSERT INTO system_account_invitations (id, token, role_id, expires_at, created_at, updated_at)
     VALUES ('invitation', 'token', '101', 2, 1, 1)`,
  )
  insertBypassingGuards(
    database,
    "system_bootstrap_state",
    `INSERT INTO system_bootstrap_state (singleton, completed_by_account_id, root_binding_id, completed_at)
     VALUES (1, '${ACCOUNT}', 'recovery-root', 1)`,
  )
  insertBypassingGuards(
    database,
    "system_procedure_definitions",
    `INSERT INTO system_procedure_definitions (key, current_revision, status, created_at, updated_at)
     VALUES ('uuid_migration_test', 1, 'active', 1, 1)`,
  )
}

function roleOf(database: Database, legacyId: string) {
  return database
    .query<{ id: string }, [string]>("SELECT id FROM system_iam_roles WHERE legacy_id = ?1")
    .get(legacyId)?.id
}

test("role と割当の UUID でない主キーを置き換え、権限・割当・招待・初期化の参照を追従させる", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    const dependentsBefore = dependents(database)
    const violationsBefore = database.query("PRAGMA foreign_key_check").all().length

    applyMigration(database, TARGET)

    const member = roleOf(database, "101")
    const root = roleOf(database, "104")
    expect([member, root].every(isUuid)).toBe(true)
    expect(
      database.query("SELECT id, legacy_id FROM system_iam_roles WHERE key = 'test:custom'").get(),
    ).toEqual({ id: UUID_ROLE, legacy_id: null })
    expect(
      database
        .query<{ role_id: string | undefined; permission_key: string }, []>(
          "SELECT role_id, permission_key FROM system_iam_role_permissions WHERE permission_key LIKE 'test:%' ORDER BY permission_key, role_id",
        )
        .all(),
    ).toEqual(
      [
        { role_id: member, permission_key: "test:read" },
        { role_id: UUID_ROLE, permission_key: "test:read" },
        { role_id: root, permission_key: "test:admin" },
      ].toSorted((a, b) =>
        `${a.permission_key}${a.role_id}`.localeCompare(`${b.permission_key}${b.role_id}`),
      ),
    )
    const binding = database
      .query<{ id: string; legacy_id: string; role_id: string }, []>(
        "SELECT id, legacy_id, role_id FROM system_role_bindings",
      )
      .get()
    expect(isUuid(binding?.id)).toBe(true)
    expect(binding).toMatchObject({ legacy_id: "recovery-root", role_id: root })
    expect(database.query("SELECT root_binding_id FROM system_bootstrap_state").get()).toEqual({
      root_binding_id: binding?.id,
    })
    expect(database.query("SELECT role_id FROM system_account_invitations").get()).toEqual({
      role_id: member,
    })
    const definition = database
      .query<{ id: string; key: string }, []>(
        "SELECT id, key FROM system_procedure_definitions WHERE key = 'uuid_migration_test'",
      )
      .get()
    expect(isUuid(definition?.id)).toBe(true)
    expect(definition?.key).toBe("uuid_migration_test")

    // 既存の index と trigger は定義ごと残り、足されるのは識別子を守る trigger だけ。
    const after = dependents(database)
    expect(dependentsBefore.filter((entry) => !after.includes(entry))).toEqual([])
    expect(
      after
        .filter((entry) => !dependentsBefore.includes(entry))
        .map((entry) => entry.split(":").slice(0, 3).join(":"))
        .toSorted(),
    ).toEqual(
      [
        ...SURROGATE_TABLES.map((table) => `trigger:${table}:${table}_identity_update`),
        ...["system_iam_roles", "system_role_bindings"].flatMap((table) => [
          `trigger:${table}:${table}_identity_update`,
          `trigger:${table}:${table}_legacy_id_insert`,
        ]),
      ].toSorted(),
    )
    expect(database.query("PRAGMA foreign_key_check").all()).toHaveLength(violationsBefore)
    // 旧来の主キーで行を足す書込みも、主キーの既定値で UUID を得る。
    database.run(
      `INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('${UUID_ROLE}', 'test:write')`,
    )
    expect(
      isUuid(
        database
          .query<{ id: string }, []>(
            "SELECT id FROM system_iam_role_permissions WHERE permission_key = 'test:write'",
          )
          .get()?.id,
      ),
    ).toBe(true)
    expect(() =>
      database.run(
        "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES ('role', 'x:y', 'custom', 'x', 1, 1)",
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

test("UUID でない提案の系列の主キーが残っていれば migration を止める", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "system_proposal_series",
      `INSERT INTO system_proposal_series (id, procedure_key, created_by_account_id, created_at)
       VALUES ('series-1', 'general', '${ACCOUNT}', 1)`,
    )

    // 行が残ることは transaction で当てる D1 の検査で確かめる。
    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})
