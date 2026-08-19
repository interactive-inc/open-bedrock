import { zAccountId } from "@system/domain/auth/account-id"
import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import { createOidcAuthorizationCode } from "@system/infrastructure/identity/create-oidc-authorization-code"
import { hashOidcSecret } from "@system/infrastructure/identity/hash-oidc-secret"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"

describe("createOidcAuthorizationCode", () => {
  test("平文codeを保存せずcanonical Accountへ束縛する", async () => {
    const fixture = new SystemSessionTestContext()
    const now = new Date("2026-01-01T00:00:00.000Z")
    fixture.sqlite.exec("INSERT INTO system_accounts VALUES ('account-1', 'active', 0, 0, 0)")
    const result = await createOidcAuthorizationCode(
      {
        var: {
          database: drizzle(fixture.context.env.DB, { schema: systemCoreSchema }),
          now: () => now,
        },
      },
      {
        issuer: "https://identity.example.test",
        clientId: "system-console",
        redirectUri: "https://console.example.test/callback",
        accountId: zAccountId.parse("account-1"),
        codeChallenge: "a".repeat(43),
        nonce: "nonce-with-enough-entropy",
        scope: ["openid"],
      },
    )

    if (result instanceof Error) throw result
    const stored = fixture.sqlite
      .query("SELECT code_hash, account_id FROM system_oidc_authorization_codes")
      .get()

    expect(stored).toEqual({
      code_hash: await hashOidcSecret(result.code),
      account_id: "account-1",
    })
    expect(stored).not.toEqual({ code_hash: result.code, account_id: "account-1" })
    fixture.sqlite.close()
  })
})
