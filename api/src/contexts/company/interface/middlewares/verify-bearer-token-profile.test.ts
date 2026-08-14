import { ACCESS_TOKEN_TYPE } from "@/contexts/system/domain/auth/access-token-claims"
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  JoseTokenSigner,
} from "@/contexts/company/infrastructure/auth/jose-token-signer"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { requestWithContext } from "@/contexts/company/interface/test-helpers/request-with-context"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"
import { describe, expect, test } from "bun:test"
import { SignJWT } from "jose"

const secret = "verify-bearer-token-profile-secret"

async function database(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
  await db.exec(
    "INSERT INTO employees (id, code, name, status) VALUES (1, 'E001', 'Active', 'active')",
  )
  await seedIamForEmployees(db, [
    { id: 1, email: "active@example.com", passwordHash: "fixture", role: "root" },
  ])
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
    const token = await new JoseTokenSigner().sign({ accountId: 1, tokenVersion: 0 }, secret)

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
      .setAudience(ACCESS_TOKEN_AUDIENCE)
      .setJti(crypto.randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(new TextEncoder().encode(secret))
    const wrongAudience = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256", typ: ACCESS_TOKEN_TYPE })
      .setSubject("1")
      .setIssuer(ACCESS_TOKEN_ISSUER)
      .setAudience("another-audience")
      .setJti(crypto.randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(new TextEncoder().encode(secret))
    const wrongType = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256", typ: "another+jwt" })
      .setSubject("1")
      .setIssuer(ACCESS_TOKEN_ISSUER)
      .setAudience(ACCESS_TOKEN_AUDIENCE)
      .setJti(crypto.randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(new TextEncoder().encode(secret))

    expect((await request(wrongIssuer)).status).toBe(401)
    expect((await request(wrongAudience)).status).toBe(401)
    expect((await request(wrongType)).status).toBe(401)
  })

  test("移行前tokenは有効期限内だけ受理する", async () => {
    const legacy = await new SignJWT({ accountId: 1, employeeId: 1, tokenVersion: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1m")
      .sign(new TextEncoder().encode(secret))

    expect((await request(legacy)).status).toBe(200)
  })
})
