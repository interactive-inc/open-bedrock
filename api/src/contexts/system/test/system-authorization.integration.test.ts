import { ResolveSystemAuthorization } from "@system/application/iam/resolve-system-authorization"
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemD1TestDatabase } from "@system/infrastructure/auth/system-d1-test-database.test-support"
import { SystemD1AuthorizationRepository } from "@system/infrastructure/iam/system-authorization-repository"
import { describe, expect, test } from "bun:test"

const schema = `
CREATE TABLE system_accounts (
  id TEXT PRIMARY KEY, status TEXT NOT NULL, token_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE system_iam_roles (
  id TEXT PRIMARY KEY, key TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL,
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
      INSERT INTO system_accounts VALUES ('account-1', 'active', 0, 1000, 1000);
      INSERT INTO system_iam_roles VALUES ('role-global', 'system:operator', 'managed', 'Operator', 1000, 1000);
      INSERT INTO system_iam_roles VALUES ('role-scoped', 'company:manager', 'custom', 'Manager', 1000, 1000);
      INSERT INTO system_iam_role_permissions VALUES ('role-global', 'iam:read');
      INSERT INTO system_iam_role_permissions VALUES ('role-scoped', 'company:write');
      INSERT INTO system_role_bindings VALUES ('binding-global', 'account-1', 'role-global', NULL, NULL, 1000, NULL);
      INSERT INTO system_role_bindings VALUES ('binding-scoped', 'account-1', 'role-scoped', 'company:organization', 'org-1', 1000, NULL);
    `)
    const resolve = new ResolveSystemAuthorization(
      new SystemD1AuthorizationRepository({ env: { DB: database } }),
    )

    const global = await resolve.execute({
      accountId: zAccountId.parse("account-1"),
      resource: null,
      at: new Date(2000),
    })
    expect(global).not.toBeInstanceOf(Error)
    if (global === null || global instanceof Error) throw global
    expect([...global.permissionKeys]).toEqual(["iam:read"])
    expect(global.roleKeys).toEqual(["system:operator"])

    const scoped = await resolve.execute({
      accountId: zAccountId.parse("account-1"),
      resource: { type: "company:organization", id: "org-1" },
      at: new Date(2000),
    })
    expect(scoped).not.toBeInstanceOf(Error)
    if (scoped === null || scoped instanceof Error) throw scoped
    expect([...scoped.permissionKeys].sort()).toEqual(["company:write", "iam:read"])
  })

  test("inactiveまたは欠損Accountを同じnullへ畳み、DB障害はErrorにする", async () => {
    const database = createSystemD1TestDatabase(schema)
    await database.exec(
      "INSERT INTO system_accounts VALUES ('account-1', 'suspended', 1, 1000, 1000)",
    )
    const resolve = new ResolveSystemAuthorization(
      new SystemD1AuthorizationRepository({ env: { DB: database } }),
    )

    expect(
      await resolve.execute({
        accountId: zAccountId.parse("account-1"),
        resource: null,
        at: new Date(2000),
      }),
    ).toBeNull()
    await database.exec("DROP TABLE system_accounts")
    expect(
      await resolve.execute({
        accountId: zAccountId.parse("account-1"),
        resource: null,
        at: new Date(2000),
      }),
    ).toBeInstanceOf(Error)
  })
})
