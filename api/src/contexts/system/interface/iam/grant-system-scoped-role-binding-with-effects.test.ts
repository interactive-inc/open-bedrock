import { grantSystemScopedRoleBindingWithEffects } from "@system/interface/iam/grant-system-scoped-role-binding-with-effects"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, test } from "bun:test"

const now = new Date("2026-01-02T00:00:00.000Z")

function fixture() {
  const test = new SystemSessionTestContext()
  for (const id of ["actor", "target"]) {
    test.sqlite
      .query(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 0, 0, 0)",
      )
      .run(id)
  }
  test.sqlite.run(
    "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES ('manager-role', 'demo:manager', 'managed', 'Manager', 0, 0)",
  )
  test.sqlite.run(
    "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES ('worker-role', 'demo:worker', 'managed', 'demo:resource', 'Worker', 0, 0)",
  )
  test.sqlite.run(
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('manager-role', 'demo:manage'), ('worker-role', 'demo:read'), ('manager-role', 'demo:read')",
  )
  test.sqlite.run(
    "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES ('actor-binding', 'actor', 'manager-role', 0)",
  )
  return test
}

function grant(test: SystemSessionTestContext, actorAccountId = "actor") {
  return grantSystemScopedRoleBindingWithEffects({
    database: test.context.env.DB,
    actorAccountId,
    targetAccountId: "target",
    bindingId: "new-binding",
    roleId: "worker-role",
    resourceType: "demo:resource",
    resourceId: "resource-1",
    requiredPermissionKey: "demo:manage",
    forbiddenPermissionKey: "system:admin",
    now,
    effects: [
      test.context.env.DB.prepare(
        "UPDATE system_accounts SET updated_at = ?1 WHERE id = 'actor'",
      ).bind(now.getTime()),
    ],
  })
}

test("role付与・外部effect・Account版・監査を同じbatchで保存する", async () => {
  const test = fixture()
  try {
    expect(await grant(test)).toEqual({ bindingId: "new-binding", created: true })
    expect(
      test.sqlite.query("SELECT updated_at FROM system_accounts WHERE id='actor'").get(),
    ).toEqual({ updated_at: now.getTime() })
    expect(
      test.sqlite
        .query("SELECT role_id, revoked_at FROM system_role_bindings WHERE id='new-binding'")
        .get(),
    ).toEqual({ role_id: "worker-role", revoked_at: null })
    expect(
      test.sqlite.query("SELECT token_version FROM system_accounts WHERE id='target'").get(),
    ).toEqual({ token_version: 1 })
    expect(
      test.sqlite
        .query("SELECT count(*) AS count FROM system_audit_events WHERE target_id='new-binding'")
        .get(),
    ).toEqual({ count: 1 })
  } finally {
    test.sqlite.close()
  }
})

test("既存の同一roleならeffectのみ確定しAccount版を進めない", async () => {
  const test = fixture()
  try {
    test.sqlite.run(
      "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('old-binding', 'target', 'worker-role', 'demo:resource', 'resource-1', 0)",
    )
    expect(await grant(test)).toEqual({ bindingId: "old-binding", created: false })
    expect(
      test.sqlite.query("SELECT updated_at FROM system_accounts WHERE id='actor'").get(),
    ).toEqual({ updated_at: now.getTime() })
    expect(
      test.sqlite.query("SELECT token_version FROM system_accounts WHERE id='target'").get(),
    ).toEqual({ token_version: 0 })
  } finally {
    test.sqlite.close()
  }
})

test("actorが失効したら外部effectも付与も拒否する", async () => {
  const test = fixture()
  try {
    test.sqlite.run("UPDATE system_role_bindings SET revoked_at = 1 WHERE id='actor-binding'")
    expect(await grant(test)).toBe("forbidden")
    expect(
      test.sqlite.query("SELECT updated_at FROM system_accounts WHERE id='actor'").get(),
    ).toEqual({ updated_at: 0 })
    expect(
      test.sqlite
        .query("SELECT count(*) AS count FROM system_role_bindings WHERE account_id='target'")
        .get(),
    ).toEqual({ count: 0 })
  } finally {
    test.sqlite.close()
  }
})
