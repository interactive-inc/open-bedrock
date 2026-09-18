import { revokeSystemScopedRoleBinding } from "@system/interface/iam/revoke-system-scoped-role-binding"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, test } from "bun:test"

const now = new Date("2026-01-02T00:00:00.000Z")

function createFixture() {
  const fixture = new SystemSessionTestContext()
  for (const accountId of ["actor", "target", "other"]) {
    fixture.sqlite
      .query(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 0, 0, 0)",
      )
      .run(accountId)
  }
  fixture.sqlite.run(
    "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES ('manager-role', 'manager-role', 'managed', 'demo:resource', 'Manager', 0, 0)",
  )
  fixture.sqlite.run(
    "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES ('global-role', 'global-role', 'managed', 'Global Manager', 0, 0)",
  )
  fixture.sqlite.run(
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('manager-role', 'demo:manage'), ('global-role', 'demo:manage')",
  )
  fixture.sqlite.run(
    "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('target-binding', 'target', 'manager-role', 'demo:resource', 'resource-1', 0)",
  )
  fixture.sqlite.run(
    "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('actor-binding', 'actor', 'global-role', NULL, NULL, 0)",
  )
  return fixture
}

function revoke(fixture: SystemSessionTestContext, actorAccountId = "actor") {
  return revokeSystemScopedRoleBinding({
    database: fixture.context.env.DB,
    actorAccountId,
    targetAccountId: "target",
    bindingId: "target-binding",
    resourceType: "demo:resource",
    resourceId: "resource-1",
    requiredPermissionKey: "demo:manage",
    managerPermissionKey: "demo:manage",
    now,
  })
}

test("最後のresource管理者の取消は履歴もAccount版も変えず拒否する", async () => {
  const fixture = createFixture()
  try {
    expect(await revoke(fixture)).toBe("last_manager")
    expect(
      fixture.sqlite
        .query("SELECT revoked_at FROM system_role_bindings WHERE id='target-binding'")
        .get(),
    ).toEqual({ revoked_at: null })
    expect(
      fixture.sqlite.query("SELECT token_version FROM system_accounts WHERE id='target'").get(),
    ).toEqual({ token_version: 0 })
  } finally {
    fixture.sqlite.close()
  }
})

test("別の管理者が残ると取消履歴・Account失効版・監査を一緒に保存する", async () => {
  const fixture = createFixture()
  try {
    fixture.sqlite.run(
      "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('other-binding', 'other', 'manager-role', 'demo:resource', 'resource-1', 0)",
    )
    expect(await revoke(fixture)).toBe("revoked")
    expect(
      fixture.sqlite
        .query("SELECT revoked_at FROM system_role_bindings WHERE id='target-binding'")
        .get(),
    ).toEqual({ revoked_at: now.getTime() })
    expect(
      fixture.sqlite.query("SELECT token_version FROM system_accounts WHERE id='target'").get(),
    ).toEqual({ token_version: 1 })
    expect(
      fixture.sqlite
        .query("SELECT count(*) AS count FROM system_audit_events WHERE target_id='target-binding'")
        .get(),
    ).toEqual({ count: 1 })
    expect(await revoke(fixture)).toBe("already_revoked")
  } finally {
    fixture.sqlite.close()
  }
})

test("resource管理権限のないAccountは取消できない", async () => {
  const fixture = createFixture()
  try {
    expect(await revoke(fixture, "other")).toBe("forbidden")
    expect(
      fixture.sqlite
        .query("SELECT revoked_at FROM system_role_bindings WHERE id='target-binding'")
        .get(),
    ).toEqual({ revoked_at: null })
  } finally {
    fixture.sqlite.close()
  }
})

test("actorが持たない権限を含むroleはresource管理者でも取消できない", async () => {
  const fixture = createFixture()
  try {
    fixture.sqlite.run(
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('manager-role', 'system:admin')",
    )
    expect(await revoke(fixture)).toBe("forbidden")
    expect(
      fixture.sqlite
        .query("SELECT revoked_at FROM system_role_bindings WHERE id='target-binding'")
        .get(),
    ).toEqual({ revoked_at: null })
  } finally {
    fixture.sqlite.close()
  }
})
