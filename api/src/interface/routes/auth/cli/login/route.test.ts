import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"

const jwtSecret = "cli-login-route-jwt-secret"
const identityLoginUrl = "https://identity-provider.example/login"
const apiOrigin = "https://api.example.com"
const now = "2026-01-01T00:00:00.000Z"

async function createTestDb(): Promise<D1Database> {
  return createD1TestDatabase(loadSchema())
}

async function getCliLogin(
  db: D1Database,
  query: string,
  overrides: { identityLoginUrl?: string; apiOrigin?: string } = {},
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: `/auth/cli/login${query}`,
    token: null,
    method: "GET",
    now,
    identityLoginUrl: overrides.identityLoginUrl ?? identityLoginUrl,
    apiOrigin: overrides.apiOrigin ?? apiOrigin,
  })
}

describe("GET /auth/cli/login", () => {
  test("redirects to the broker's login URL with a callback and a freshly minted broker state", async () => {
    const db = await createTestDb()

    const response = await getCliLogin(db, "?port=51820&state=cli-opaque-state-1", {})

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    expect(location).not.toBeNull()
    if (location === null) throw new Error("missing Location header")

    const url = new URL(location)
    expect(`${url.origin}${url.pathname}`).toBe("https://identity-provider.example/login")
    expect(url.searchParams.get("callback")).toBe("https://api.example.com/auth/cli/callback")
    const brokerState = url.searchParams.get("state")
    expect(brokerState).not.toBeNull()
    expect(brokerState).not.toBe("cli-opaque-state-1")

    const row = await db
      .prepare("SELECT port, cli_state FROM cli_login_states WHERE state = ?1")
      .bind(brokerState)
      .first<{ port: number; cli_state: string }>()
    expect(row).toEqual({ port: 51820, cli_state: "cli-opaque-state-1" })
  })

  test("rejects an out-of-range port", async () => {
    const db = await createTestDb()

    const response = await getCliLogin(db, "?port=70000&state=cli-opaque-state-2")

    expect(response.status).toBe(400)
  })

  test("rejects a missing state", async () => {
    const db = await createTestDb()

    const response = await getCliLogin(db, "?port=51820")

    expect(response.status).toBe(400)
  })

  test("rejects when cli login is not configured", async () => {
    const db = await createTestDb()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/auth/cli/login?port=51820&state=cli-opaque-state-3",
      token: null,
      method: "GET",
      now,
      // IDENTITY_LOGIN_URL / API_ORIGIN を渡さない = 未設定。
    })

    expect(response.status).toBe(401)
  })
})
