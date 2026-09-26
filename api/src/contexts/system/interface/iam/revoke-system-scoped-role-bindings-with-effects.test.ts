import { revokeSystemScopedRoleBindingsWithEffects } from "@system/interface/iam/revoke-system-scoped-role-bindings-with-effects"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, test } from "bun:test"

const now = new Date("2026-01-02T00:00:00.000Z")

function fixture() {
  const test = new SystemSessionTestContext()
  test.sqlite.run(`CREATE TABLE system_account_invitations (
    id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, email TEXT NOT NULL,
    role_id TEXT NOT NULL, resource_type TEXT, resource_id TEXT,
    related_resource_id TEXT, accepted_by_account_id TEXT,
    expires_at INTEGER NOT NULL, revoked_at INTEGER,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`)
  for (const id of ["actor", "target", "other"]) {
    test.sqlite
      .query(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 0, 0, 0)",
      )
      .run(id)
  }
  for (const [id, resource] of [
    ["f8dc2e88-fc2d-4a67-8c0e-11db39f67d75", null],
    ["848c3ab1-d54e-4ef8-82ff-dbc3e9f23620", "demo:resource"],
  ]) {
    test.sqlite
      .query(
        "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES (?1, ?2, 'managed', ?3, ?1, 0, 0)",
      )
      .run(id, `demo:${id}`, resource)
    test.sqlite
      .query(
        "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, 'demo:manage')",
      )
      .run(id)
  }
  test.sqlite.run(
    "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES ('36328491-0ba8-4a11-8b8d-26aff298e39b', 'actor', 'f8dc2e88-fc2d-4a67-8c0e-11db39f67d75', 0)",
  )
  test.sqlite.run(
    "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('f1a3ed01-15a3-41da-8ebb-2457a6038f84', 'target', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:resource', 'resource-1', 0)",
  )
  return test
}

function revoke(
  test: SystemSessionTestContext,
  invitationRelatedResourceIds: string[] = [],
  database = test.context.env.DB,
) {
  return revokeSystemScopedRoleBindingsWithEffects({
    database,
    actorAccountId: "actor",
    targetAccountId: "target",
    resourceType: "demo:resource",
    resourceId: "resource-1",
    requiredPermissionKey: "demo:manage",
    managerPermissionKey: "demo:manage",
    invitationRelatedResourceIds,
    now,
    effects: [
      test.context.env.DB.prepare(
        "UPDATE system_accounts SET updated_at = ?1 WHERE id = 'actor'",
      ).bind(now.getTime()),
    ],
  })
}

function insertInvitation(
  test: SystemSessionTestContext,
  id: string,
  resourceId: string,
  relatedResourceId: string,
  state: "pending" | "used" | "expired" | "revoked" = "pending",
) {
  test.sqlite
    .query(
      `INSERT INTO system_account_invitations
      (id, token, email, role_id, resource_type, resource_id, related_resource_id,
       accepted_by_account_id, expires_at, revoked_at, created_at, updated_at)
     VALUES (?1, ?1, 'person@example.com', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:resource', ?2, ?3,
             ?4, ?5, ?6, 0, 0)`,
    )
    .run(
      id,
      resourceId,
      relatedResourceId,
      state === "used" ? "target" : null,
      state === "expired" ? 1 : now.getTime() + 1000,
      state === "revoked" ? 1 : null,
    )
}

test("最後の管理者を外すと外部effectもロール失効もロールバックする", async () => {
  const test = fixture()
  try {
    expect(await revoke(test)).toBe("last_manager")
    expect(
      test.sqlite.query("SELECT updated_at FROM system_accounts WHERE id='actor'").get(),
    ).toEqual({ updated_at: 0 })
    expect(
      test.sqlite
        .query(
          "SELECT revoked_at FROM system_role_bindings WHERE id='f1a3ed01-15a3-41da-8ebb-2457a6038f84'",
        )
        .get(),
    ).toEqual({ revoked_at: null })
  } finally {
    test.sqlite.close()
  }
})

test("別の管理者がいれば外部effect・履歴・監査を同時に保存する", async () => {
  const test = fixture()
  try {
    test.sqlite.run(
      "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('17e9fca7-165d-44c4-8e80-4b3d024c4554', 'other', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:resource', 'resource-1', 0)",
    )
    expect(await revoke(test)).toBe("revoked")
    expect(
      test.sqlite.query("SELECT updated_at FROM system_accounts WHERE id='actor'").get(),
    ).toEqual({ updated_at: now.getTime() })
    expect(
      test.sqlite
        .query(
          "SELECT revoked_at FROM system_role_bindings WHERE id='f1a3ed01-15a3-41da-8ebb-2457a6038f84'",
        )
        .get(),
    ).toEqual({ revoked_at: now.getTime() })
    expect(
      test.sqlite.query("SELECT token_version FROM system_accounts WHERE id='target'").get(),
    ).toEqual({ token_version: 1 })
    expect(
      test.sqlite
        .query(
          "SELECT count(*) AS count FROM system_audit_events WHERE target_id='f1a3ed01-15a3-41da-8ebb-2457a6038f84'",
        )
        .get(),
    ).toEqual({ count: 1 })
  } finally {
    test.sqlite.close()
  }
})

test("招待の施設・関連資源を限定し、未使用の有効招待だけを監査付きで失効する", async () => {
  const test = fixture()
  try {
    test.sqlite.run(
      "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('17e9fca7-165d-44c4-8e80-4b3d024c4554', 'other', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:resource', 'resource-1', 0)",
    )
    insertInvitation(test, "pending", "resource-1", "assignment-1")
    insertInvitation(test, "used", "resource-1", "assignment-1", "used")
    insertInvitation(test, "expired", "resource-1", "assignment-1", "expired")
    insertInvitation(test, "revoked", "resource-1", "assignment-1", "revoked")
    insertInvitation(test, "dbcd34b4-9c95-419a-8fc3-d992cd5566d7", "resource-2", "assignment-1")
    insertInvitation(test, "other-assignment", "resource-1", "assignment-2")

    expect(await revoke(test, ["assignment-1"])).toBe("revoked")
    expect(
      test.sqlite
        .query("SELECT id, revoked_at AS revokedAt FROM system_account_invitations ORDER BY id")
        .all(),
    ).toEqual([
      { id: "dbcd34b4-9c95-419a-8fc3-d992cd5566d7", revokedAt: null },
      { id: "expired", revokedAt: null },
      { id: "other-assignment", revokedAt: null },
      { id: "pending", revokedAt: now.getTime() },
      { id: "revoked", revokedAt: 1 },
      { id: "used", revokedAt: null },
    ])
    expect(
      test.sqlite
        .query(
          "SELECT action, target_id AS targetId FROM system_audit_events WHERE target_type = 'system:account-invitation'",
        )
        .all(),
    ).toEqual([{ action: "system.account_invitation.revoked", targetId: "pending" }])
  } finally {
    test.sqlite.close()
  }
})

test("最後の管理者を外せない場合は招待の失効も取り消す", async () => {
  const test = fixture()
  try {
    insertInvitation(test, "pending", "resource-1", "assignment-1")
    expect(await revoke(test, ["assignment-1"])).toBe("last_manager")
    expect(
      test.sqlite
        .query("SELECT revoked_at FROM system_account_invitations WHERE id = 'pending'")
        .get(),
    ).toEqual({ revoked_at: null })
    expect(
      test.sqlite
        .query("SELECT count(*) AS count FROM system_audit_events WHERE target_id = 'pending'")
        .get(),
    ).toEqual({ count: 0 })
  } finally {
    test.sqlite.close()
  }
})

test("招待の読み取り後に同じ資源の招待が増えたら全変更を競合として戻す", async () => {
  const test = fixture()
  try {
    test.sqlite.run(
      "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('17e9fca7-165d-44c4-8e80-4b3d024c4554', 'other', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:resource', 'resource-1', 0)",
    )
    insertInvitation(test, "original", "resource-1", "assignment-1")
    const base = test.context.env.DB
    const database = {
      ...base,
      batch: async (statements: D1PreparedStatement[]) => {
        insertInvitation(test, "concurrent", "resource-1", "assignment-1")
        return base.batch(statements)
      },
    } as D1Database

    expect(await revoke(test, ["assignment-1"], database)).toBe("conflict")
    expect(
      test.sqlite
        .query("SELECT id, revoked_at AS revokedAt FROM system_account_invitations ORDER BY id")
        .all(),
    ).toEqual([
      { id: "concurrent", revokedAt: null },
      { id: "original", revokedAt: null },
    ])
    expect(
      test.sqlite
        .query(
          "SELECT revoked_at FROM system_role_bindings WHERE id = 'f1a3ed01-15a3-41da-8ebb-2457a6038f84'",
        )
        .get(),
    ).toEqual({ revoked_at: null })
    expect(
      test.sqlite
        .query("SELECT count(*) AS count FROM system_audit_events WHERE target_id = 'original'")
        .get(),
    ).toEqual({ count: 0 })
  } finally {
    test.sqlite.close()
  }
})
