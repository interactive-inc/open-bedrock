import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import { TEST_MIGRATIONS_DIR } from "@/api/test/migrations-directory"
import { POST as companyBootstrapPOST } from "@/contexts/company/interface/routes/company.v1.bootstrap"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { SystemHTTPException } from "@system/interface/errors"
import { systemFactory } from "@system/interface/http/system-factory"
import { POST as systemBootstrapPOST } from "@system/interface/routes/system.v1.bootstrap"
import { POST as systemSessionPOST } from "@system/interface/routes/system.v1.sessions"
import { describe, expect, test } from "bun:test"
import { hc } from "hono/client"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const now = new Date()
const bootstrapToken = "company-bootstrap-test-token"
const jwtSecret = "company-bootstrap-test-jwt-secret"
const pepper = "company-bootstrap-test-pepper"
const schemaSql = readdirSync(TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")

describe("Company Bootstrap HTTP", () => {
  test("System rootだけがCompanyを初期化でき、失敗後はCompanyだけを安全に再実行できる", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    const app = systemFactory
      .createApp()
      .onError((error, context) => {
        if (!(error instanceof SystemHTTPException || error instanceof CompanyHTTPException)) {
          throw error
        }

        const title =
          error.status === 400
            ? "Bad Request"
            : error.status === 401
              ? "Unauthorized"
              : error.status === 409
                ? "Conflict"
                : "Service Unavailable"

        return context.json(
          {
            type: `/problems/${error.code}`,
            title,
            status: error.status,
            code: error.code,
            detail: error.detail,
          },
          error.status,
          { "content-type": "application/problem+json" },
        )
      })
      .use("*", async (context, next) => {
        context.set("now", () => now)
        await next()
      })
      .post("/system/v1/bootstrap", ...systemBootstrapPOST)
      .post("/system/v1/sessions", ...systemSessionPOST)
      .post("/company/v1/bootstrap", ...companyBootstrapPOST)
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

    const invalid = await client.company.v1.bootstrap.$post(
      { json: { name: "" } },
      { headers: { authorization: `Bearer ${sessionBody.access_token}` } },
    )
    expect(Number(invalid.status)).toBe(400)
    expect(invalid.headers.get("content-type")).toBe("application/problem+json")
    const invalidBody: unknown = await invalid.json()
    expect(invalidBody).toEqual({
      type: "/problems/invalid_company_bootstrap_input",
      title: "Bad Request",
      status: 400,
      code: "invalid_company_bootstrap_input",
      detail: "Company bootstrap request body is invalid",
    })

    await database.exec(`
      CREATE TRIGGER reject_company_bootstrap_link
      BEFORE INSERT ON company_resource_heads
      WHEN NEW.resource_type = 'account-employee-link'
      BEGIN
        SELECT RAISE(ABORT, 'link unavailable');
      END;
    `)
    const failed = await client.company.v1.bootstrap.$post(
      { json: { name: "Root Admin" } },
      { headers: { authorization: `Bearer ${sessionBody.access_token}` } },
    )
    expect(Number(failed.status)).toBe(503)
    expect(
      await database
        .prepare(
          "SELECT COUNT(*) AS total FROM company_resource_heads WHERE resource_type = 'employee'",
        )
        .first<number>("total"),
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
    expect(createdBody).toMatchObject({ employee_id: expect.stringMatching(/^employee:/) })
    expect("account_id" in createdBody).toBe(true)

    const repeated = await client.company.v1.bootstrap.$post(
      { json: { name: "Other Admin" } },
      { headers: { authorization: `Bearer ${sessionBody.access_token}` } },
    )
    expect(Number(repeated.status)).toBe(409)
    const repeatedBody: unknown = await repeated.json()
    expect(repeatedBody).toEqual({
      type: "/problems/already_initialized",
      title: "Conflict",
      status: 409,
      code: "already_initialized",
      detail: "Company is already initialized",
    })
    expect(
      await database
        .prepare(
          "SELECT COUNT(*) AS total FROM company_resource_heads WHERE resource_type = 'employee'",
        )
        .first<number>("total"),
    ).toBe(1)
  })
})
