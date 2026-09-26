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
    "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES ('848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'manager-role', 'managed', 'demo:resource', 'Manager', 0, 0)",
  )
  fixture.sqlite.run(
    "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES ('f8dc2e88-fc2d-4a67-8c0e-11db39f67d75', 'global-role', 'managed', 'Global Manager', 0, 0)",
  )
  fixture.sqlite.run(
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:manage'), ('f8dc2e88-fc2d-4a67-8c0e-11db39f67d75', 'demo:manage')",
  )
  fixture.sqlite.run(
    "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('f1a3ed01-15a3-41da-8ebb-2457a6038f84', 'target', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:resource', 'resource-1', 0)",
  )
  fixture.sqlite.run(
    "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('36328491-0ba8-4a11-8b8d-26aff298e39b', 'actor', 'f8dc2e88-fc2d-4a67-8c0e-11db39f67d75', NULL, NULL, 0)",
  )
  return fixture
}

function revoke(fixture: SystemSessionTestContext, actorAccountId = "actor") {
  return revokeSystemScopedRoleBinding({
    database: fixture.context.env.DB,
    actorAccountId,
    targetAccountId: "target",
    bindingId: "f1a3ed01-15a3-41da-8ebb-2457a6038f84",
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
        .query(
          "SELECT revoked_at FROM system_role_bindings WHERE id='f1a3ed01-15a3-41da-8ebb-2457a6038f84'",
        )
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
      "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('17e9fca7-165d-44c4-8e80-4b3d024c4554', 'other', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:resource', 'resource-1', 0)",
    )
    expect(await revoke(fixture)).toBe("revoked")
    expect(
      fixture.sqlite
        .query(
          "SELECT revoked_at FROM system_role_bindings WHERE id='f1a3ed01-15a3-41da-8ebb-2457a6038f84'",
        )
        .get(),
    ).toEqual({ revoked_at: now.getTime() })
    expect(
      fixture.sqlite.query("SELECT token_version FROM system_accounts WHERE id='target'").get(),
    ).toEqual({ token_version: 1 })
    expect(
      fixture.sqlite
        .query(
          "SELECT count(*) AS count FROM system_audit_events WHERE target_id='f1a3ed01-15a3-41da-8ebb-2457a6038f84'",
        )
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
        .query(
          "SELECT revoked_at FROM system_role_bindings WHERE id='f1a3ed01-15a3-41da-8ebb-2457a6038f84'",
        )
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
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'system:admin')",
    )
    expect(await revoke(fixture)).toBe("forbidden")
    expect(
      fixture.sqlite
        .query(
          "SELECT revoked_at FROM system_role_bindings WHERE id='f1a3ed01-15a3-41da-8ebb-2457a6038f84'",
        )
        .get(),
    ).toEqual({ revoked_at: null })
  } finally {
    fixture.sqlite.close()
  }
})
