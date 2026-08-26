import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { CreateOidcAccessTokenAdapter } from "@system/infrastructure/adapters/identity/create-oidc-access-token.adapter"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"

describe("createOidcAccessToken", () => {
  test("平文tokenを保存しない", async () => {
    const fixture = new SystemSessionTestContext()
    fixture.sqlite.exec("INSERT INTO system_accounts VALUES ('account-1', 'active', 0, NULL, 0, 0)")
    const result = await new CreateOidcAccessTokenAdapter({
      var: {
        database: drizzle(fixture.context.env.DB, { schema: systemCoreSchema }),
        now: () => new Date("2026-01-01T00:00:00.000Z"),
      },
    }).createOidcAccessToken({
      issuer: "https://identity.example.test",
      clientId: "system-console",
      accountId: zAccountId.parse("account-1"),
      scope: "openid",
    })

    if (result instanceof Error) throw result
    const stored = fixture.sqlite
      .query<{ token_hash: string }, []>("SELECT token_hash FROM system_oidc_access_tokens")
      .get()

    expect(stored?.token_hash).not.toBe(result.accessToken)
    expect(stored?.token_hash).toMatch(/^[a-f0-9]{64}$/)
    fixture.sqlite.close()
  })
})
