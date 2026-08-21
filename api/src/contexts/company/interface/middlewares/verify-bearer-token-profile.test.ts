import { ACCESS_TOKEN_TYPE } from "@system/domain/values/access-token-claims.schema"
import {
  SYSTEM_ACCESS_TOKEN_AUDIENCE,
  SYSTEM_ACCESS_TOKEN_ISSUER,
} from "@system/infrastructure/auth/system-access-token-profile.repository"
import { SystemAccessTokenIssuer } from "@system/infrastructure/auth/system-access-token-issuer.repository"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { verifyCompanyMigration } from "@/api/test/support/verify-company-migration"
import { describe, expect, test } from "bun:test"
import { SignJWT } from "jose"
import { testAccountId } from "@/api/test/support/test-account-id"

const secret = "verify-bearer-token-profile-secret"

async function database(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
  await db.exec(
    "INSERT INTO employees (id, code, name, status) VALUES (1, 'E001', 'Active', 'active')",
  )
  await seedIamForEmployees(db, [
    { id: 1, email: "active@example.com", passwordHash: "fixture", role: "root" },
  ])
  await verifyCompanyMigration(db)

  return db
}

async function request(token: string): Promise<Response> {
  return requestWithContext({
    db: await database(),
    jwtSecret: secret,
    path: "/me",
    token,
    now: "2026-06-01T00:00:00.000Z",
  })
}

describe("verifyBearer access token profile", () => {
  test("accepts the case-insensitive Bearer scheme through the shared parser", async () => {
    const token = await new SystemAccessTokenIssuer(secret).issue({
      accountId: testAccountId(1),
      tokenVersion: 0,
      now: new Date(),
    })

    expect(token).not.toBeInstanceOf(Error)
    if (token instanceof Error) return

    const response = await requestWithContext({
      db: await database(),
      jwtSecret: secret,
      path: "/me",
      token: null,
      now: "2026-06-01T00:00:00.000Z",
      headers: { Authorization: `bearer ${token}` },
    })

    expect(response.status).toBe(200)
  })

  test("issuer・audience・typeの取り違えを拒否する", async () => {
    const now = Math.floor(Date.now() / 1000)
    const claims = {
      ver: 0,
      purpose: "api-session",
      issuedAtMs: Date.now(),
    }
    const wrongIssuer = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256", typ: ACCESS_TOKEN_TYPE })
      .setSubject("1")
      .setIssuer("another-issuer")
      .setAudience(SYSTEM_ACCESS_TOKEN_AUDIENCE)
      .setJti(crypto.randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(new TextEncoder().encode(secret))
    const wrongAudience = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256", typ: ACCESS_TOKEN_TYPE })
      .setSubject("1")
      .setIssuer(SYSTEM_ACCESS_TOKEN_ISSUER)
      .setAudience("another-audience")
      .setJti(crypto.randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(new TextEncoder().encode(secret))
    const wrongType = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256", typ: "another+jwt" })
      .setSubject("1")
      .setIssuer(SYSTEM_ACCESS_TOKEN_ISSUER)
      .setAudience(SYSTEM_ACCESS_TOKEN_AUDIENCE)
      .setJti(crypto.randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(new TextEncoder().encode(secret))

    expect((await request(wrongIssuer)).status).toBe(401)
    expect((await request(wrongAudience)).status).toBe(401)
    expect((await request(wrongType)).status).toBe(401)
  })

  test("canonical profileを持たないtokenは有効期限内でも拒否する", async () => {
    const nonCanonical = await new SignJWT({ accountId: 1, employeeId: 1, tokenVersion: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1m")
      .sign(new TextEncoder().encode(secret))

    expect((await request(nonCanonical)).status).toBe(401)
  })
})
