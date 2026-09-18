import { listSystemAccountResourceIds } from "@system/interface/iam/list-system-account-resource-ids"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, test } from "bun:test"

test("Systemの有効な指定resource bindingだけを返す", async () => {
  const fixture = new SystemSessionTestContext()
  try {
    fixture.sqlite.run(
      "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('account-1', 'active', 0, 0, 0)",
    )
    fixture.sqlite.run(
      "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES ('role-1', 'role-1', 'managed', 'Role', 0, 0)",
    )
    for (const [id, resourceType, resourceId, revokedAt] of [
      ["active", "demo:resource", "resource-1", null],
      ["other", "demo:other", "other-1", null],
      ["revoked", "demo:resource", "resource-2", 1],
    ] as const) {
      fixture.sqlite
        .query(
          "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at) VALUES (?1, 'account-1', 'role-1', ?2, ?3, 0, ?4)",
        )
        .run(id, resourceType, resourceId, revokedAt)
    }

    expect(
      await listSystemAccountResourceIds({
        database: fixture.context.env.DB,
        accountId: "account-1",
        resourceType: "demo:resource",
      }),
    ).toEqual(["resource-1"])
    expect(
      await listSystemAccountResourceIds({
        database: fixture.context.env.DB,
        accountId: "account-1",
        resourceType: "invalid",
      }),
    ).toBeInstanceOf(Error)
  } finally {
    fixture.sqlite.close()
  }
})
