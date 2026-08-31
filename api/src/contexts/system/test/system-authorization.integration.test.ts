import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createSystemD1TestDatabase } from "@system/test/create-system-d1-test-database.test-support"
import { systemResourceScopeKey } from "@system/domain/definitions/system-resource-scope-key.definition"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"
import { describe, expect, test } from "bun:test"

const schema = `
CREATE TABLE system_accounts (
  id TEXT PRIMARY KEY, status TEXT NOT NULL, token_version INTEGER NOT NULL,
  closed_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE system_iam_roles (
  id TEXT PRIMARY KEY, key TEXT NOT NULL, kind TEXT NOT NULL, resource_type TEXT, name TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE system_iam_role_permissions (
  role_id TEXT NOT NULL, permission_key TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_key)
);
CREATE TABLE system_role_bindings (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL, role_id TEXT NOT NULL,
  resource_type TEXT, resource_id TEXT, created_at INTEGER NOT NULL, revoked_at INTEGER
);
`

describe("canonical System authorization", () => {
  test("active Accountのglobalと完全一致resource bindingだけをlive解決する", async () => {
    const database = createSystemD1TestDatabase(schema)
    await database.exec(`
      INSERT INTO system_accounts VALUES ('account-1', 'active', 0, NULL, 1000, 1000);
      INSERT INTO system_iam_roles VALUES ('role-global', 'system:operator', 'managed', NULL, 'Operator', 1000, 1000);
      INSERT INTO system_iam_roles VALUES ('role-scoped', 'example:manager', 'custom', 'example:organization', 'Manager', 1000, 1000);
      INSERT INTO system_iam_role_permissions VALUES ('role-global', 'iam:read');
      INSERT INTO system_iam_role_permissions VALUES ('role-scoped', 'example:write');
      INSERT INTO system_role_bindings VALUES ('binding-global', 'account-1', 'role-global', NULL, NULL, 1000, NULL);
      INSERT INTO system_role_bindings VALUES ('binding-scoped', 'account-1', 'role-scoped', 'example:organization', 'org-1', 1000, NULL);
    `)
    const repository = new SystemD1AuthorizationAdapter({ env: { DB: database } })

    const graph = await repository.loadForAccount(zAccountId.parse("account-1"))
    expect(graph).not.toBeInstanceOf(Error)
    if (graph === null || graph instanceof Error) throw graph
    expect(graph.roles.find((role) => role.id === "role-global")?.resourceType).toBeNull()
    expect(graph.roles.find((role) => role.id === "role-scoped")?.resourceType).toBe(
      "example:organization",
    )

    const global = await repository.resolveForAccount({
      accountId: zAccountId.parse("account-1"),
      resource: null,
      at: new Date(2000),
    })
    expect(global).not.toBeInstanceOf(Error)
    if (global === null || global instanceof Error) throw global
    expect([...global.permissionKeys]).toEqual(["iam:read"])
    expect(global.roleKeys).toEqual(["system:operator"])
    expect([
      ...(global.scopedPermissionKeys.get(
        systemResourceScopeKey({ type: "example:organization", id: "org-1" }),
      ) ?? []),
    ]).toEqual(["example:write"])

    const scoped = await repository.resolveForAccount({
      accountId: zAccountId.parse("account-1"),
      resource: { type: "example:organization", id: "org-1" },
      at: new Date(2000),
    })
    expect(scoped).not.toBeInstanceOf(Error)
    if (scoped === null || scoped instanceof Error) throw scoped
    expect([...scoped.permissionKeys].sort()).toEqual(["example:write", "iam:read"])

    await database.exec(`
      INSERT INTO system_iam_roles VALUES ('role-broken', 'example:broken', 'custom', 'example:site', 'Broken', 1000, 1000);
      INSERT INTO system_iam_role_permissions VALUES ('role-broken', 'example:write');
      INSERT INTO system_role_bindings VALUES ('binding-broken', 'account-1', 'role-broken', 'example:organization', 'org-1', 1000, NULL);
    `)
    expect(await repository.loadForAccount(zAccountId.parse("account-1"))).toBeInstanceOf(Error)
  })

  test("inactiveまたは欠損Accountを同じnullへ畳み、DB障害はErrorにする", async () => {
    const database = createSystemD1TestDatabase(schema)
    await database.exec(
      "INSERT INTO system_accounts VALUES ('account-1', 'suspended', 1, NULL, 1000, 1000)",
    )
    const repository = new SystemD1AuthorizationAdapter({ env: { DB: database } })

    expect(
      await repository.resolveForAccount({
        accountId: zAccountId.parse("account-1"),
        resource: null,
        at: new Date(2000),
      }),
    ).toBeNull()
    await database.exec("DROP TABLE system_accounts")
    expect(
      await repository.resolveForAccount({
        accountId: zAccountId.parse("account-1"),
        resource: null,
        at: new Date(2000),
      }),
    ).toBeInstanceOf(Error)
  })
})
