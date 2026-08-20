import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import { systemFactory } from "@system/interface/http/system-factory"
import { POST } from "@system/interface/routes/system.v1.bootstrap"
import { describe, expect, test } from "bun:test"
import { hc } from "hono/client"

const now = new Date("2026-01-01T00:00:00.000Z")
const bootstrapToken = "system-bootstrap-test-token"

describe("System Bootstrap HTTP", () => {
  test("single-use credentialでCompanyなしのroot Account一式を一度だけ作る", async () => {
    const fixture = new SystemSessionTestContext()
    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => now)
        await next()
      })
      .post("/system/v1/bootstrap", ...POST)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        BOOTSTRAP_TOKEN: bootstrapToken,
        PEPPER_SECRET: "system-bootstrap-test-pepper",
      })
    const client = hc<typeof app>("http://system.test", { fetch: request })

    const invalidCredential = await client.system.v1.bootstrap.$post({
      json: {
        token: "wrong-bootstrap-token",
        email: "root@example.com",
        password: "correct horse battery staple",
      },
    })
    expect(Number(invalidCredential.status)).toBe(401)

    const created = await client.system.v1.bootstrap.$post({
      json: {
        token: bootstrapToken,
        email: "ROOT@example.com",
        password: "correct horse battery staple",
      },
    })
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect("account_id" in createdBody).toBe(true)
    if (!("account_id" in createdBody)) return
    expect(createdBody.email).toBe("root@example.com")
    expect(
      fixture.sqlite
        .query(
          `SELECT role.key
           FROM system_role_bindings binding
           INNER JOIN system_iam_roles role ON role.id = binding.role_id
           WHERE binding.account_id = ?1 AND binding.revoked_at IS NULL`,
        )
        .get(createdBody.account_id),
    ).toEqual({ key: "system:root" })
    expect(
      fixture.sqlite
        .query(
          `SELECT permission_key
           FROM system_iam_role_permissions
           ORDER BY permission_key`,
        )
        .all(),
    ).toEqual([
      { permission_key: "iam:read" },
      { permission_key: "iam:write" },
      { permission_key: "system:admin" },
    ])

    const repeated = await client.system.v1.bootstrap.$post({
      json: {
        token: bootstrapToken,
        email: "other@example.com",
        password: "another correct horse battery staple",
      },
    })
    expect(Number(repeated.status)).toBe(409)
    expect(fixture.sqlite.query("SELECT count(*) AS total FROM system_accounts").get()).toEqual({
      total: 1,
    })
    expect(fixture.sqlite.query("SELECT count(*) AS total FROM system_audit_events").get()).toEqual(
      { total: 1 },
    )
  })

  test("bootstrap credential未設定時はvalidatorより先に経路を隠す", async () => {
    const fixture = new SystemSessionTestContext()
    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => now)
        await next()
      })
      .post("/system/v1/bootstrap", ...POST)
    const response = await app.request(
      "/system/v1/bootstrap",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
      { DB: fixture.context.env.DB, PEPPER_SECRET: "system-bootstrap-test-pepper" },
    )

    expect(response.status).toBe(404)
  })
})
