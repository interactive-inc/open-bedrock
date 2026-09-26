import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { wrapSystemD1TestDatabase } from "@system/test/wrap-system-d1-test-database.test-support"
import { prepareSystemHumanOperationAuthorization } from "@system/interface/operations/prepare-system-human-operation-authorization"

function fixture() {
  const sqlite = new Database(":memory:")
  for (const schema of ["system-core.sql", "system-principal.sql"])
    sqlite.exec(
      readFileSync(new URL(`../../infrastructure/schema/${schema}`, import.meta.url), "utf8"),
    )
  sqlite.exec(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
    VALUES ('actor:1', 'active', 0, 100, 100);
    INSERT INTO system_principals (id, account_id, kind, name, revision, created_at, updated_at)
    VALUES ('principal:1', 'actor:1', 'human', 'Operator', 1, 100, 100);
    INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
    VALUES ('4e74c1bb-6f90-452e-852b-b723b635cc75', 'operator', 'custom', 'Operator', 100, 100);
    INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('4e74c1bb-6f90-452e-852b-b723b635cc75', 'records:write');
    INSERT INTO system_role_bindings (id, account_id, role_id, created_at)
    VALUES ('d50d88aa-2e8e-4e9b-8d15-2a1fb3ed6a4c', 'actor:1', '4e74c1bb-6f90-452e-852b-b723b635cc75', 100);`)
  return { sqlite, database: wrapSystemD1TestDatabase(sqlite) }
}

test("呼び出し側が選んだ権限で判定し、保存時の照合文を返す", async () => {
  const { sqlite, database } = fixture()
  const input = { database, accountId: "actor:1", tokenVersion: 0, now: new Date(1000) }
  const proof = await prepareSystemHumanOperationAuthorization({
    ...input,
    permissions: ["records:write"],
  })
  if (proof === "forbidden" || proof instanceof Error) throw new Error("authorization failed")
  expect(proof.principalId).toBe("principal:1")
  await database.batch([...proof.assertions])
  expect(
    await prepareSystemHumanOperationAuthorization({ ...input, permissions: ["records:delete"] }),
  ).toBe("forbidden")
  sqlite.exec("UPDATE system_role_bindings SET revoked_at = 500")
  expect(await database.batch([...proof.assertions]).catch((cause) => cause)).toBeInstanceOf(Error)
})
