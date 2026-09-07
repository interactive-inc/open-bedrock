import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { wrapSystemD1TestDatabase } from "@system/test/wrap-system-d1-test-database.test-support"
import { SystemServiceOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-service-operation-authorization.adapter"

function fixture() {
  const sqlite = new Database(":memory:")
  sqlite.exec("PRAGMA foreign_keys = ON")
  sqlite.exec(readFileSync(new URL("../../schema/system-core.sql", import.meta.url), "utf8"))
  sqlite.exec(readFileSync(new URL("../../schema/system-integration.sql", import.meta.url), "utf8"))
  sqlite.exec(readFileSync(new URL("../../schema/system-principal.sql", import.meta.url), "utf8"))
  sqlite.exec(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
    VALUES ('actor:1', 'active', 0, 100, 100);
    INSERT INTO system_principals (id, account_id, kind, name, revision, created_at, updated_at)
    VALUES ('principal:1', 'actor:1', 'service', 'Operator', 1, 100, 100);
    INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
    VALUES ('role:1', 'operator', 'custom', 'Operator', 100, 100);
    INSERT INTO system_iam_role_permissions VALUES ('role:1', 'records:write'), ('role:1', 'records:read');
    INSERT INTO system_role_bindings (id, account_id, role_id, created_at)
    VALUES ('binding:1', 'actor:1', 'role:1', 100);
    CREATE TABLE test_records (id TEXT PRIMARY KEY);`)
  const database = wrapSystemD1TestDatabase(sqlite)
  const adapter = new SystemServiceOperationAuthorizationAdapter({ env: { DB: database } })
  const input = {
    accountId: "actor:1",
    tokenVersion: 0,
    permissions: ["records:read", "records:write"],
    now: new Date(1000),
  }
  return { sqlite, database, adapter, input }
}

test("現在のServiceの権限を合成し、global管理者も同じ保存条件を持つ", async () => {
  const { sqlite, database, adapter, input } = fixture()
  for (const admin of [false, true]) {
    if (admin)
      sqlite.exec(
        "DELETE FROM system_iam_role_permissions; INSERT INTO system_iam_role_permissions VALUES ('role:1', 'system:admin')",
      )
    const proof = await adapter.prepare(input)
    if (proof === "forbidden" || proof instanceof Error)
      throw new Error("authorization failed", { cause: proof })
    expect(proof.principalId).toBe("principal:1")
    await database.batch([
      ...proof.assertions,
      database.prepare("INSERT INTO test_records VALUES (?)").bind(String(admin)),
      ...proof.assertions,
    ])
  }
  expect(sqlite.query("SELECT count(*) AS count FROM test_records").get()).toEqual({ count: 2 })
})

test("期限・対象scope・Principalの種別・token版を検査する", async () => {
  for (const mutation of [
    "UPDATE system_role_bindings SET revoked_at = 1000",
    "DELETE FROM system_role_bindings; INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('scope:1', 'actor:1', 'role:1', 'records', 'record:1', 100)",
    "UPDATE system_principals SET kind = 'agent', revision = 2",
    "UPDATE system_principals SET kind = 'human', revision = 2",
    "UPDATE system_accounts SET status = 'suspended', token_version = 1, updated_at = 1001",
    "DELETE FROM system_role_bindings; INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES ('future:1', 'actor:1', 'role:1', 1001)",
    "UPDATE system_accounts SET token_version = 1",
    "DELETE FROM system_iam_role_permissions WHERE permission_key = 'records:write'",
  ]) {
    const { sqlite, adapter, input } = fixture()
    sqlite.exec(mutation)
    expect(await adapter.prepare(input)).toBe("forbidden")
  }
  const { sqlite, adapter, input } = fixture()
  sqlite.exec("UPDATE system_role_bindings SET revoked_at = 1001")
  expect(await adapter.prepare(input)).not.toBe("forbidden")
  expect(await adapter.prepare({ ...input, now: new Date(1001) })).toBe("forbidden")
  expect(await adapter.prepare({ ...input, permissions: [] })).toBe("forbidden")
})

test("検査後の状態・付与元の変化で、保存transaction全体を取り消す", async () => {
  for (const mutation of [
    "UPDATE system_accounts SET status = 'suspended', token_version = 1, updated_at = 1001",
    "UPDATE system_accounts SET token_version = 1, updated_at = 1001",
    "UPDATE system_principals SET revision = 2, updated_at = 1001",
    "UPDATE system_role_bindings SET revoked_at = 1001",
    "DELETE FROM system_iam_role_permissions WHERE permission_key = 'records:write'",
    "UPDATE system_iam_roles SET name = 'Changed', updated_at = 1001",
  ]) {
    const { sqlite, database, adapter, input } = fixture()
    const proof = await adapter.prepare(input)
    if (proof === "forbidden" || proof instanceof Error)
      throw new Error("authorization failed", { cause: proof })
    sqlite.exec(mutation)
    const result = await database
      .batch([database.prepare("INSERT INTO test_records VALUES ('new')"), ...proof.assertions])
      .then(
        () => null,
        (cause: unknown) => cause,
      )
    expect(SystemServiceOperationAuthorizationAdapter.rejected(result)).toBe(true)
    expect(sqlite.query("SELECT count(*) AS count FROM test_records").get()).toEqual({ count: 0 })
  }
})
