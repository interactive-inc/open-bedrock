import { replaceSystemScopedRoleBinding } from "@system/interface/iam/replace-system-scoped-role-binding"
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
  for (const [id, permission] of [
    ["global-role", "demo:manage"],
    ["manager-role", "demo:manage"],
    ["worker-role", "demo:read"],
  ]) {
    test.sqlite
      .query(
        "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES (?1, ?2, 'managed', ?3, ?1, 0, 0)",
      )
      .run(id, `demo:${id}`, id === "global-role" ? null : "demo:resource")
    test.sqlite
      .query("INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, ?2)")
      .run(id, permission)
  }
  test.sqlite.run(
    "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('actor-binding', 'actor', 'global-role', NULL, NULL, 0)",
  )
  test.sqlite.run(
    "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('old-binding', 'target', 'manager-role', 'demo:resource', 'resource-1', 0)",
  )
  return test
}

function replace(test: SystemSessionTestContext, roleId = "manager-role") {
  return replaceSystemScopedRoleBinding({
    database: test.context.env.DB,
    actorAccountId: "actor",
    targetAccountId: "target",
    bindingId: "new-binding",
    roleId,
    resourceType: "demo:resource",
    resourceId: "resource-1",
    requiredPermissionKey: "demo:manage",
    managerPermissionKey: "demo:manage",
    now,
  })
}

test("置換は旧bindingを履歴として残し、新binding・版・監査を原子的に作る", async () => {
  const test = fixture()
  try {
    expect(await replace(test)).toBe("replaced")
    expect(
      test.sqlite
        .query(
          "SELECT id, revoked_at FROM system_role_bindings WHERE account_id='target' ORDER BY id",
        )
        .all(),
    ).toEqual([
      { id: "new-binding", revoked_at: null },
      { id: "old-binding", revoked_at: now.getTime() },
    ])
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

test("最後の管理者を非管理ロールに置換すると全変更をロールバックする", async () => {
  const test = fixture()
  try {
    test.sqlite.run(
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('global-role', 'demo:read')",
    )
    expect(await replace(test, "worker-role")).toBe("last_manager")
    expect(
      test.sqlite
        .query("SELECT id, revoked_at FROM system_role_bindings WHERE account_id='target'")
        .all(),
    ).toEqual([{ id: "old-binding", revoked_at: null }])
    expect(
      test.sqlite.query("SELECT token_version FROM system_accounts WHERE id='target'").get(),
    ).toEqual({ token_version: 0 })
  } finally {
    test.sqlite.close()
  }
})

test("actorにない権限を含むroleは置換できない", async () => {
  const test = fixture()
  try {
    test.sqlite.run(
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('manager-role', 'system:admin')",
    )
    expect(await replace(test)).toBe("forbidden")
    expect(
      test.sqlite
        .query("SELECT count(*) AS count FROM system_role_bindings WHERE account_id='target'")
        .get(),
    ).toEqual({ count: 1 })
  } finally {
    test.sqlite.close()
  }
})
