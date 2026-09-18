import { listSystemScopedRoleBindings } from "@system/interface/iam/list-system-scoped-role-bindings"
import { readSystemRoleSummary } from "@system/interface/iam/read-system-role-summary"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, test } from "bun:test"

test("Systemの公開読取は指定resource・時点・Accountの有効なbindingだけを返す", async () => {
  const fixture = new SystemSessionTestContext()
  try {
    fixture.sqlite.run(
      "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('target', 'active', 0, 0, 0), ('other', 'active', 0, 0, 0)",
    )
    fixture.sqlite.run(
      "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES ('manager-role', 'demo:manager', 'managed', 'demo:resource', 'Manager', 0, 0)",
    )
    fixture.sqlite.run(
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('manager-role', 'demo:manage'), ('manager-role', 'demo:read')",
    )
    fixture.sqlite.run(
      `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at) VALUES
       ('active', 'target', 'manager-role', 'demo:resource', 'resource-1', 100, NULL),
       ('future', 'other', 'manager-role', 'demo:resource', 'resource-1', 300, NULL),
       ('revoked', 'other', 'manager-role', 'demo:resource', 'resource-1', 0, 50),
       ('other-resource', 'other', 'manager-role', 'demo:resource', 'resource-2', 0, NULL)`,
    )

    const result = await listSystemScopedRoleBindings({
      database: fixture.context.env.DB,
      resourceType: "demo:resource",
      resourceId: "resource-1",
      at: new Date(200),
    })
    expect(result).toEqual([
      {
        id: "active",
        accountId: "target",
        roleId: "manager-role",
        resourceId: "resource-1",
        createdAt: new Date(100),
        permissionKeys: ["demo:manage", "demo:read"],
      },
    ])
    expect(
      await listSystemScopedRoleBindings({
        database: fixture.context.env.DB,
        resourceType: "demo:resource",
        resourceId: "resource-1",
        accountId: "other",
        at: new Date(200),
      }),
    ).toEqual([])
    expect(
      await readSystemRoleSummary({
        database: fixture.context.env.DB,
        roleId: "manager-role",
      }),
    ).toEqual({
      id: "manager-role",
      resourceType: "demo:resource",
      permissionKeys: ["demo:manage", "demo:read"],
    })
  } finally {
    fixture.sqlite.close()
  }
})
