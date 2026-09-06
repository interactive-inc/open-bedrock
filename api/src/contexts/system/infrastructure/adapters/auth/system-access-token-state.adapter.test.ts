import { SystemAccessTokenStateAdapter } from "@system/infrastructure/adapters/auth/system-access-token-state.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { afterEach, describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"

const fixtures: Array<SystemSessionTestContext> = []
const input = {
  accountId: zAccountId.parse("account-1"),
  tokenVersion: 0,
  issuedAtMs: 1_000,
  at: new Date(1_000),
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.sqlite.close()
})

function createFixture() {
  const fixture = new SystemSessionTestContext()
  fixtures.push(fixture)
  fixture.sqlite.exec(`
    INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
    VALUES ('account-1', 'active', 0, 1, 1), ('account-2', 'active', 0, 1, 1);
    INSERT INTO system_principals
    (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
    VALUES ('principal-1', 'account-1', 'service', 'Primary', NULL, 1, 1, 1),
           ('principal-2', 'account-2', 'service', 'Other', NULL, 1, 1, 1);
  `)
  fixture.sqlite
    .query(`
    INSERT INTO system_machine_credentials
    (id, principal_id, name, secret_hash, status, created_at, updated_at, last_used_at, expires_at)
    VALUES ('credential-1', 'principal-1', 'Primary', ?1, 'active', 100, 1000, 1000, 2000),
           ('credential-2', 'principal-2', 'Other', ?2, 'active', 100, 1000, 1000, 2000)
  `)
    .run("1".repeat(64), "2".repeat(64))
  return fixture
}

describe("SystemAccessTokenStateAdapter", () => {
  test("D1と注入されたDrizzle driverで同じ主体と来歴を復元する", async () => {
    const fixture = createFixture()
    for (const database of [fixture.context.env.DB, drizzle(fixture.context.env.DB)]) {
      const state = await new SystemAccessTokenStateAdapter({ database }).resolve({
        ...input,
        machineCredentialId: "credential-1",
      })
      expect(state).toMatchObject({
        kind: "accepted",
        account: { id: "account-1" },
        machine: {
          principalId: "principal-1",
          kind: "service",
          credentialId: "credential-1",
          connectorId: null,
        },
      })
      expect(JSON.stringify(state)).not.toContain("1".repeat(64))
    }
  })

  test("別Accountのcredentialを同じ有効期限・版で指定しても拒否する", async () => {
    const fixture = createFixture()
    expect(
      await new SystemAccessTokenStateAdapter({ database: fixture.context.env.DB }).resolve({
        ...input,
        machineCredentialId: "credential-2",
      }),
    ).toEqual({ kind: "rejected", reason: "invalid_machine_credential" })
  })

  test.each([99, 1_001, 2_000])(
    "credentialの作成前・最終認証後・失効時点の発行時刻%sを拒否する",
    async (issuedAtMs) => {
      const fixture = createFixture()
      expect(
        await new SystemAccessTokenStateAdapter({ database: fixture.context.env.DB }).resolve({
          ...input,
          machineCredentialId: "credential-1",
          issuedAtMs,
        }),
      ).toEqual({ kind: "rejected", reason: "invalid_machine_credential" })
    },
  )

  test("Humanへ変更されたPrincipalは機械credentialを利用できない", async () => {
    const fixture = createFixture()
    fixture.sqlite.exec("UPDATE system_principals SET kind = 'human', revision = revision + 1")
    expect(
      await new SystemAccessTokenStateAdapter({ database: fixture.context.env.DB }).resolve({
        ...input,
        machineCredentialId: "credential-1",
      }),
    ).toEqual({ kind: "rejected", reason: "invalid_machine_credential" })
  })

  test("人のtokenはHumanおよびPrincipal導入前のAccountで継続する", async () => {
    const fixture = createFixture()
    fixture.sqlite.exec(`
      UPDATE system_principals SET kind = 'human', revision = revision + 1;
      INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      VALUES ('legacy-human', 'active', 0, 1, 1);
    `)
    for (const accountId of [input.accountId, zAccountId.parse("legacy-human")]) {
      expect(
        await new SystemAccessTokenStateAdapter({ database: fixture.context.env.DB }).resolve({
          ...input,
          accountId,
        }),
      ).toMatchObject({ kind: "accepted", machine: null })
    }
  })

  test("状態の読取失敗を認証成功へfallbackしない", async () => {
    const fixture = createFixture()
    fixture.sqlite.close()
    fixtures.splice(fixtures.indexOf(fixture), 1)
    expect(
      await new SystemAccessTokenStateAdapter({ database: fixture.context.env.DB }).resolve({
        ...input,
        machineCredentialId: "credential-1",
      }),
    ).toBeInstanceOf(Error)
  })
})
