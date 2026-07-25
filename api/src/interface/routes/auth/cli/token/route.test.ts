import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { cliLoginCodeHash } from "@/lib/auth/cli-login-code-hash"
import { z } from "zod"

const jwtSecret = "cli-token-route-jwt-secret"
const now = "2026-01-01T00:00:00.000Z"
const nowEpoch = 1_767_225_600

const tokenResponseSchema = z.strictObject({
  access_token: z.string(),
  refresh_token: z.string(),
})

async function createTestDb(): Promise<D1Database> {
  return createD1TestDatabase(loadSchema())
}

async function seedCliLoginCode(
  db: D1Database,
  code: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: number = nowEpoch + 60,
): Promise<void> {
  const codeHash = await cliLoginCodeHash(code)
  await db
    .prepare(
      `INSERT INTO cli_login_codes (code_hash, access_token, refresh_token, expires_at)
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(codeHash, accessToken, refreshToken, expiresAt)
    .run()
}

function postCliToken(db: D1Database, body: unknown): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/auth/cli/token",
    token: null,
    method: "POST",
    body,
    now,
  })
}

describe("POST /auth/cli/token", () => {
  test("exchanges a valid one-time code for the AccessTokenView shape", async () => {
    const db = await createTestDb()
    await seedCliLoginCode(db, "raw-code-1", "access-token-value", "refresh-token-value")

    const response = await postCliToken(db, { code: "raw-code-1" })

    expect(response.status).toBe(200)
    const body = tokenResponseSchema.parse(await response.json())
    expect(body).toEqual({
      access_token: "access-token-value",
      refresh_token: "refresh-token-value",
    })
  })

  test("consumes the code so it cannot be exchanged twice", async () => {
    const db = await createTestDb()
    await seedCliLoginCode(db, "raw-code-2", "access-token-value-2", "refresh-token-value-2")

    const first = await postCliToken(db, { code: "raw-code-2" })
    expect(first.status).toBe(200)

    const second = await postCliToken(db, { code: "raw-code-2" })
    expect(second.status).toBe(401)

    const remaining = await db
      .prepare("SELECT COUNT(*) AS count FROM cli_login_codes")
      .first<number>("count")
    expect(remaining).toBe(0)
  })

  test("returns 401 for an unknown code", async () => {
    const db = await createTestDb()

    const response = await postCliToken(db, { code: "never-issued" })

    expect(response.status).toBe(401)
  })

  test("returns 401 for an expired code", async () => {
    const db = await createTestDb()
    await seedCliLoginCode(
      db,
      "raw-code-expired",
      "access-token-value-3",
      "refresh-token-value-3",
      nowEpoch - 1,
    )

    const response = await postCliToken(db, { code: "raw-code-expired" })

    expect(response.status).toBe(401)
  })

  test("rejects an empty code with a 400", async () => {
    const db = await createTestDb()

    const response = await postCliToken(db, { code: "" })

    expect(response.status).toBe(400)
  })
})
