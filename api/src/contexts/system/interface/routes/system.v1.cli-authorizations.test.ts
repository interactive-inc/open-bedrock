import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import type { SystemHonoEnv } from "@system/interface/http/system-factory"
import { GET } from "@system/interface/routes/system.v1.cli-authorizations"
import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

const now = new Date("2026-01-01T00:00:00.000Z")

function createFixture(
  configuration: Readonly<{ identityLoginUrl?: string; apiOrigin?: string }> = Object.freeze({
    identityLoginUrl: "https://identity-provider.example/login",
    apiOrigin: "https://api.example.com",
  }),
) {
  const fixture = new SystemSessionTestContext()
  const app = new Hono<SystemHonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .get("/system/v1/cli-authorizations", ...GET)
  const client = hc<typeof app>("http://system.test", {
    fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        IDENTITY_LOGIN_URL: configuration.identityLoginUrl,
        API_ORIGIN: configuration.apiOrigin,
      }),
  })

  return Object.freeze({ client, fixture })
}

describe("GET /system/v1/cli-authorizations", () => {
  test("stores a one-time PKCE state and redirects to the configured Identity provider", async () => {
    const { client, fixture } = createFixture()

    const response = await client.system.v1["cli-authorizations"].$get({
      query: { port: "51820", state: "cli-opaque-state-1" },
    })

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    const url = new URL(location)
    expect(`${url.origin}${url.pathname}`).toBe("https://identity-provider.example/login")
    expect(url.searchParams.get("callback")).toBe(
      "https://api.example.com/system/v1/cli-authorization-callback",
    )
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const brokerState = url.searchParams.get("state")
    expect(brokerState).not.toBeNull()
    expect(brokerState).not.toBe("cli-opaque-state-1")
    expect(
      fixture.sqlite
        .query(
          "SELECT port, cli_state, code_verifier FROM system_cli_login_states WHERE state = ?1",
        )
        .get(brokerState),
    ).toEqual({
      port: 51_820,
      cli_state: "cli-opaque-state-1",
      code_verifier: expect.stringMatching(/^[A-Za-z0-9_-]{43,128}$/),
    })
  })

  test("rejects an invalid port before creating authorization state", async () => {
    const { client, fixture } = createFixture()

    const invalidPort = await client.system.v1["cli-authorizations"].$get({
      query: { port: "70000", state: "cli-opaque-state-2" },
    })
    expect(Number(invalidPort.status)).toBe(400)
    expect(fixture.sqlite.query("SELECT state FROM system_cli_login_states").all()).toEqual([])
  })

  test("fails closed when CLI Identity configuration is missing or insecure", async () => {
    const missing = createFixture(Object.freeze({}))
    const insecure = createFixture(
      Object.freeze({
        identityLoginUrl: "http://identity-provider.example/login",
        apiOrigin: "https://api.example.com",
      }),
    )

    const missingResponse = await missing.client.system.v1["cli-authorizations"].$get({
      query: { port: "51820", state: "cli-opaque-state-3" },
    })
    const insecureResponse = await insecure.client.system.v1["cli-authorizations"].$get({
      query: { port: "51820", state: "cli-opaque-state-4" },
    })

    expect(missingResponse.status).toBe(503)
    expect(insecureResponse.status).toBe(503)
    expect(missing.fixture.sqlite.query("SELECT state FROM system_cli_login_states").all()).toEqual(
      [],
    )
    expect(
      insecure.fixture.sqlite.query("SELECT state FROM system_cli_login_states").all(),
    ).toEqual([])
  })
})
