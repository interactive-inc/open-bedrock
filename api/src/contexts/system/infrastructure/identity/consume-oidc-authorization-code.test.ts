import { zAccountId } from "@system/domain/auth/account-id"
import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import { consumeOidcAuthorizationCode } from "@system/infrastructure/identity/consume-oidc-authorization-code.repository"
import { createOidcAuthorizationCode } from "@system/infrastructure/identity/create-oidc-authorization-code.repository"
import { toPkceS256Challenge } from "@system/infrastructure/auth/to-pkce-s256-challenge.repository"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"

const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

describe("consumeOidcAuthorizationCode", () => {
  test("誤ったverifier・issuer・client・redirect URIでは消費しない", async () => {
    const fixture = new SystemSessionTestContext()
    const now = new Date("2026-01-01T00:00:00.000Z")
    const accountId = zAccountId.parse("account-1")
    fixture.sqlite.exec("INSERT INTO system_accounts VALUES ('account-1', 'active', 0, 0, 0)")
    const context = {
      var: {
        database: drizzle(fixture.context.env.DB, { schema: systemCoreSchema }),
        now: () => now,
      },
    }
    const issued = await createOidcAuthorizationCode(context, {
      issuer: "https://identity.example.test",
      clientId: "system-console",
      redirectUri: "https://console.example.test/callback",
      accountId,
      codeChallenge: await toPkceS256Challenge(verifier),
      nonce: "nonce-with-enough-entropy",
      scope: ["openid"],
    })

    if (issued instanceof Error) throw issued
    const valid = {
      issuer: "https://identity.example.test",
      clientId: "system-console",
      redirectUri: "https://console.example.test/callback",
      code: issued.code,
      verifier,
    }

    expect(
      await consumeOidcAuthorizationCode(context, {
        ...valid,
        verifier: `${verifier.slice(0, -1)}A`,
      }),
    ).toBeNull()
    expect(
      await consumeOidcAuthorizationCode(context, {
        ...valid,
        issuer: "https://secondary.identity.example.test",
      }),
    ).toBeNull()
    expect(
      await consumeOidcAuthorizationCode(context, { ...valid, clientId: "other-client" }),
    ).toBeNull()
    expect(
      await consumeOidcAuthorizationCode(context, {
        ...valid,
        redirectUri: "https://attacker.example.test/callback",
      }),
    ).toBeNull()
    expect(await consumeOidcAuthorizationCode(context, valid)).toEqual({
      accountId,
      nonce: "nonce-with-enough-entropy",
      scope: "openid",
    })
    expect(await consumeOidcAuthorizationCode(context, valid)).toBeNull()
    fixture.sqlite.close()
  })

  test("期限切れcodeを消費しない", async () => {
    const fixture = new SystemSessionTestContext()
    const issuedAt = new Date("2026-01-01T00:00:00.000Z")
    const accountId = zAccountId.parse("account-1")
    fixture.sqlite.exec("INSERT INTO system_accounts VALUES ('account-1', 'active', 0, 0, 0)")
    const database = drizzle(fixture.context.env.DB, { schema: systemCoreSchema })
    const issued = await createOidcAuthorizationCode(
      { var: { database, now: () => issuedAt } },
      {
        issuer: "https://identity.example.test",
        clientId: "system-console",
        redirectUri: "https://console.example.test/callback",
        accountId,
        codeChallenge: await toPkceS256Challenge(verifier),
        nonce: "nonce-with-enough-entropy",
        scope: ["openid"],
      },
    )

    if (issued instanceof Error) throw issued
    expect(
      await consumeOidcAuthorizationCode(
        { var: { database, now: () => new Date("2026-01-01T00:02:00.000Z") } },
        {
          issuer: "https://identity.example.test",
          clientId: "system-console",
          redirectUri: "https://console.example.test/callback",
          code: issued.code,
          verifier,
        },
      ),
    ).toBeNull()
    fixture.sqlite.close()
  })

  test("PKCE条件を満たす並行交換を一件だけ成功させる", async () => {
    const fixture = new SystemSessionTestContext()
    const now = new Date("2026-01-01T00:00:00.000Z")
    const accountId = zAccountId.parse("account-1")
    fixture.sqlite.exec("INSERT INTO system_accounts VALUES ('account-1', 'active', 0, 0, 0)")
    const context = {
      var: {
        database: drizzle(fixture.context.env.DB, { schema: systemCoreSchema }),
        now: () => now,
      },
    }
    const issued = await createOidcAuthorizationCode(context, {
      issuer: "https://identity.example.test",
      clientId: "system-console",
      redirectUri: "https://console.example.test/callback",
      accountId,
      codeChallenge: await toPkceS256Challenge(verifier),
      nonce: "nonce-with-enough-entropy",
      scope: ["openid", "email"],
    })

    if (issued instanceof Error) throw issued
    const props = {
      issuer: "https://identity.example.test",
      clientId: "system-console",
      redirectUri: "https://console.example.test/callback",
      code: issued.code,
      verifier,
    }
    const consumed = await Promise.all(
      Array.from({ length: 8 }, () => consumeOidcAuthorizationCode(context, props)),
    )

    expect(consumed.filter((result) => result !== null && !(result instanceof Error))).toEqual([
      {
        accountId,
        nonce: "nonce-with-enough-entropy",
        scope: "openid email",
      },
    ])
    fixture.sqlite.close()
  })
})
