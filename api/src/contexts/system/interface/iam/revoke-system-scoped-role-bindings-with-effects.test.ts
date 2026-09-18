import { revokeSystemScopedRoleBindingsWithEffects } from "@system/interface/iam/revoke-system-scoped-role-bindings-with-effects"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, test } from "bun:test"

const now = new Date("2026-01-02T00:00:00.000Z")

function fixture() {
  const test = new SystemSessionTestContext()
  for (const id of ["actor", "target", "other"]) {
    test.sqlite
      .query(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 0, 0, 0)",
      )
      .run(id)
  }
  for (const [id, resource] of [
    ["global-role", null],
    ["manager-role", "demo:resource"],
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
    "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES ('actor-binding', 'actor', 'global-role', 0)",
  )
  test.sqlite.run(
    "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('target-binding', 'target', 'manager-role', 'demo:resource', 'resource-1', 0)",
  )
  return test
}

function revoke(test: SystemSessionTestContext) {
  return revokeSystemScopedRoleBindingsWithEffects({
    database: test.context.env.DB,
    actorAccountId: "actor",
    targetAccountId: "target",
    resourceType: "demo:resource",
    resourceId: "resource-1",
    requiredPermissionKey: "demo:manage",
    managerPermissionKey: "demo:manage",
    now,
    effects: [
      test.context.env.DB.prepare(
        "UPDATE system_accounts SET updated_at = ?1 WHERE id = 'actor'",
      ).bind(now.getTime()),
    ],
  })
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
        .query("SELECT revoked_at FROM system_role_bindings WHERE id='target-binding'")
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
      "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('other-binding', 'other', 'manager-role', 'demo:resource', 'resource-1', 0)",
    )
    expect(await revoke(test)).toBe("revoked")
    expect(
      test.sqlite.query("SELECT updated_at FROM system_accounts WHERE id='actor'").get(),
    ).toEqual({ updated_at: now.getTime() })
    expect(
      test.sqlite
        .query("SELECT revoked_at FROM system_role_bindings WHERE id='target-binding'")
        .get(),
    ).toEqual({ revoked_at: now.getTime() })
    expect(
      test.sqlite.query("SELECT token_version FROM system_accounts WHERE id='target'").get(),
    ).toEqual({ token_version: 1 })
    expect(
      test.sqlite
        .query("SELECT count(*) AS count FROM system_audit_events WHERE target_id='target-binding'")
        .get(),
    ).toEqual({ count: 1 })
  } finally {
    test.sqlite.close()
  }
})
