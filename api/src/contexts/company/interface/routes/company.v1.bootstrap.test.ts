import { app } from "@/api/app"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { describe, expect, test } from "bun:test"
import { hc } from "hono/client"

const now = new Date()
const bootstrapToken = "company-bootstrap-test-token"
const jwtSecret = "company-bootstrap-test-jwt-secret"
const pepper = "company-bootstrap-test-pepper"

describe("Company Bootstrap HTTP", () => {
  test("System rootだけがCompanyを初期化でき、失敗後はCompanyだけを安全に再実行できる", async () => {
    const database = createD1TestDatabase(loadSchema())
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: database,
        BOOTSTRAP_TOKEN: bootstrapToken,
        JWT_SECRET: jwtSecret,
        PEPPER_SECRET: pepper,
        NOW: now.toISOString(),
        AUDIT_HMAC_SECRET: "company-bootstrap-audit-hmac-secret",
        COMPANY_TIME_ZONE: "Asia/Tokyo",
      })
    const client = hc<typeof app>("http://company.test", { fetch: request })

    const systemBootstrap = await client.system.v1.bootstrap.$post({
      json: {
        token: bootstrapToken,
        email: "root@example.com",
        password: "correct horse battery staple",
      },
    })
    expect(systemBootstrap.status).toBe(201)

    const session = await client.system.v1.sessions.$post({
      json: { subject: "root@example.com", password: "correct horse battery staple" },
    })
    expect(session.status).toBe(201)
    const sessionBody = await session.json()
    if (!("access_token" in sessionBody)) throw new Error("expected a System Session")

    const anonymous = await client.company.v1.bootstrap.$post({
      json: { name: "Root Admin" },
    })
    expect(Number(anonymous.status)).toBe(401)

    await database.exec(`
      CREATE TRIGGER reject_company_bootstrap_link
      BEFORE INSERT ON account_employee_links
      BEGIN
        SELECT RAISE(ABORT, 'link unavailable');
      END;
    `)
    const failed = await client.company.v1.bootstrap.$post(
      { json: { name: "Root Admin" } },
      { headers: { authorization: `Bearer ${sessionBody.access_token}` } },
    )
    expect(failed.status).toBe(503)
    expect(
      await database.prepare("SELECT COUNT(*) AS total FROM employees").first<number>("total"),
    ).toBe(0)
    expect(
      await database
        .prepare("SELECT COUNT(*) AS total FROM system_bootstrap_state")
        .first<number>("total"),
    ).toBe(1)
    await database.exec("DROP TRIGGER reject_company_bootstrap_link")

    const created = await client.company.v1.bootstrap.$post(
      { json: { name: "Root Admin" } },
      { headers: { authorization: `Bearer ${sessionBody.access_token}` } },
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody).toMatchObject({ employee_id: 1 })
    expect("account_id" in createdBody).toBe(true)

    const repeated = await client.company.v1.bootstrap.$post(
      { json: { name: "Other Admin" } },
      { headers: { authorization: `Bearer ${sessionBody.access_token}` } },
    )
    expect(repeated.status).toBe(409)
    expect(await repeated.json()).toEqual({
      error: "Company is already initialized",
      code: "already_initialized",
    })
    expect(
      await database.prepare("SELECT COUNT(*) AS total FROM employees").first<number>("total"),
    ).toBe(1)
  })
})
