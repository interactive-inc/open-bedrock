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
    ["f8dc2e88-fc2d-4a67-8c0e-11db39f67d75", "demo:manage"],
    ["848c3ab1-d54e-4ef8-82ff-dbc3e9f23620", "demo:manage"],
    ["0bca4bb5-bf10-40ca-8a09-903b1efa21e3", "demo:read"],
  ]) {
    test.sqlite
      .query(
        "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES (?1, ?2, 'managed', ?3, ?1, 0, 0)",
      )
      .run(id, `demo:${id}`, id === "f8dc2e88-fc2d-4a67-8c0e-11db39f67d75" ? null : "demo:resource")
    test.sqlite
      .query("INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, ?2)")
      .run(id, permission)
  }
  test.sqlite.run(
    "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('36328491-0ba8-4a11-8b8d-26aff298e39b', 'actor', 'f8dc2e88-fc2d-4a67-8c0e-11db39f67d75', NULL, NULL, 0)",
  )
  test.sqlite.run(
    "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('0f19bbdb-7229-4e11-8ec3-d8ebfa90844e', 'target', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:resource', 'resource-1', 0)",
  )
  return test
}

function replace(test: SystemSessionTestContext, roleId = "848c3ab1-d54e-4ef8-82ff-dbc3e9f23620") {
  return replaceSystemScopedRoleBinding({
    database: test.context.env.DB,
    actorAccountId: "actor",
    targetAccountId: "target",
    bindingId: "c9b573fc-3b92-41cb-8bae-4d53a633cf4f",
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
          "SELECT id, revoked_at FROM system_role_bindings WHERE account_id='target' ORDER BY revoked_at IS NOT NULL, id",
        )
        .all(),
    ).toEqual([
      { id: "c9b573fc-3b92-41cb-8bae-4d53a633cf4f", revoked_at: null },
      { id: "0f19bbdb-7229-4e11-8ec3-d8ebfa90844e", revoked_at: now.getTime() },
    ])
    expect(
      test.sqlite.query("SELECT token_version FROM system_accounts WHERE id='target'").get(),
    ).toEqual({ token_version: 1 })
    expect(
      test.sqlite
        .query(
          "SELECT count(*) AS count FROM system_audit_events WHERE target_id='c9b573fc-3b92-41cb-8bae-4d53a633cf4f'",
        )
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
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('f8dc2e88-fc2d-4a67-8c0e-11db39f67d75', 'demo:read')",
    )
    expect(await replace(test, "0bca4bb5-bf10-40ca-8a09-903b1efa21e3")).toBe("last_manager")
    expect(
      test.sqlite
        .query("SELECT id, revoked_at FROM system_role_bindings WHERE account_id='target'")
        .all(),
    ).toEqual([{ id: "0f19bbdb-7229-4e11-8ec3-d8ebfa90844e", revoked_at: null }])
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
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'system:admin')",
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
