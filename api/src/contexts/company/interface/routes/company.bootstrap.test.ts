import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { POST as companyBootstrapPOST } from "@/contexts/company/interface/routes/company.bootstrap"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { SystemHTTPException } from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { POST as systemBootstrapPOST } from "@system/interface/routes/system.bootstrap"
import { POST as systemSessionPOST } from "@system/interface/routes/system.sessions"
import { describe, expect, test } from "bun:test"
import { hc } from "hono/client"
import { createFactory } from "hono/factory"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const now = new Date()
const bootstrapToken = "company-bootstrap-test-token"
const jwtSecret = "company-bootstrap-test-jwt-secret"
const pepper = "company-bootstrap-test-pepper"
const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")

type BootstrapTestEnvironment = {
  Bindings: SystemHonoEnv["Bindings"] & CompanyHttpEnvironment["Bindings"]
  Variables: SystemHonoEnv["Variables"] & CompanyHttpEnvironment["Variables"]
}

const bootstrapTestFactory = createFactory<BootstrapTestEnvironment>()

describe("Company Bootstrap HTTP", () => {
  test("System rootだけがCompanyを初期化でき、失敗後はCompanyだけを安全に再実行できる", async () => {
    const database = createCompanyD1TestDatabase(schemaSql)
    const app = bootstrapTestFactory
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
      .use("/company/*", authenticateSystemAccessToken)
      .use("/company/*", async (context, next) => {
        context.set(
          "companyActor",
          CompanyActorValue.restore({
            accountId: String(context.var.userId),
            employeeId: null,
            organizationIds: ["organization:default"],
            capabilities: context.var.permissions.has("system:admin") ? ["company:admin"] : [],
          }),
        )
        context.set("companyClock", () => now)
        await next()
      })
      .post("/system/bootstrap", ...systemBootstrapPOST)
      .post("/system/sessions", ...systemSessionPOST)
      .post("/company/bootstrap", ...companyBootstrapPOST)
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

    const systemBootstrap = await client.system.bootstrap.$post({
      json: {
        token: bootstrapToken,
        email: "root@example.com",
        password: "correct horse battery staple",
      },
    })
    expect(systemBootstrap.status).toBe(201)

    const session = await client.system.sessions.$post({
      json: {
        subject: "root@example.com",
        password: "correct horse battery staple",
      },
    })
    expect(session.status).toBe(201)
    const sessionBody = await session.json()
    if (!("access_token" in sessionBody)) throw new Error("expected a System Session")

    const anonymous = await client.company.bootstrap.$post({
      json: { name: "Root Admin" },
    })
    expect(Number(anonymous.status)).toBe(401)

    const invalid = await client.company.bootstrap.$post(
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
      BEFORE INSERT ON company_account_employee_links
      BEGIN
        SELECT RAISE(ABORT, 'link unavailable');
      END;
    `)
    const failed = await client.company.bootstrap.$post(
      { json: { name: "Root Admin" } },
      { headers: { authorization: `Bearer ${sessionBody.access_token}` } },
    )
    expect(Number(failed.status)).toBe(503)
    expect(
      await database
        .prepare("SELECT COUNT(*) AS total FROM company_employees")
        .first<number>("total"),
    ).toBe(0)
    expect(
      await database
        .prepare("SELECT COUNT(*) AS total FROM system_bootstrap_state")
        .first<number>("total"),
    ).toBe(1)
    await database.exec("DROP TRIGGER reject_company_bootstrap_link")

    const created = await client.company.bootstrap.$post(
      { json: { name: "Root Admin" } },
      { headers: { authorization: `Bearer ${sessionBody.access_token}` } },
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody).toMatchObject({
      employee_id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
    })
    expect("account_id" in createdBody).toBe(true)

    const repeated = await client.company.bootstrap.$post(
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
        .prepare("SELECT COUNT(*) AS total FROM company_employees")
        .first<number>("total"),
    ).toBe(1)
  })
})
