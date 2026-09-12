import { handleApiError } from "@/api/error-response/handle-api-error"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { companyRouteManifest } from "@/contexts/company/interface/route-manifest"
import { companySchema } from "@/contexts/company/infrastructure/schema/company"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import {
  companyAuthenticatedRoutes,
  companyAuditedRoutes,
} from "@/contexts/company/interface/routes/company"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { Hono } from "hono"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")

function createTestDatabase() {
  const binding = createCompanyD1TestDatabase(schemaSql)
  return { binding, database: drizzle(binding, { schema: companySchema }) }
}

function createApp(
  database: ReturnType<typeof createTestDatabase>["database"],
  capabilities: ReadonlyArray<"company:read">,
): Hono<CompanyHttpEnvironment> {
  const app = new Hono<CompanyHttpEnvironment>()
  app.onError(handleApiError)
  app.use("*", async (c, next) => {
    c.set("database", database)
    c.set("auditContext", {
      requestId: "company-definition-permissions-test",
      clientName: "api",
      clientIp: null,
      externalRequestId: null,
    })
    c.set(
      "companyActor",
      CompanyActorValue.restore({
        accountId: "account-1",
        employeeId: null,
        organizationIds: ["organization:default"],
        capabilities,
        permissions: [],
      }),
    )
    c.set("companyClock", () => new Date("2026-08-28T00:00:00.000Z"))
    await next()
  })
  app.route("", companyAuthenticatedRoutes)
  app.route("", companyAuditedRoutes)
  return app
}

describe("Company等級定義の権限", () => {
  test("旧台帳の参照・書込を登録せず、公開履歴へ統一する", () => {
    const legacy = companyRouteManifest.filter((route) =>
      [
        "/company/grade-definitions",
        "/company/position-definitions",
        "/company/employee-grades",
      ].some((path) => route.path === path || route.path.startsWith(`${path}/`)),
    )
    expect(legacy).toEqual([])
  })
  test("削除した旧経路は認証済みでも404になる", async () => {
    const { binding, database } = createTestDatabase()
    const app = createApp(database, ["company:read"])
    for (const path of ["/employee-grades", "/grade-definitions", "/position-definitions"])
      for (const method of ["GET", "POST", "PUT", "DELETE"])
        expect((await app.request(path, { method }, { DB: binding })).status).toBe(404)
  })
  test("公開定義はcompany:readがあればGETでき、なければ403になる", async () => {
    const { binding, database } = createTestDatabase()
    const allowed = await createApp(database, ["company:read"]).request(
      "/definitions",
      { headers: { "x-company-organization-id": "organization:default" } },
      { DB: binding },
    )
    const denied = await createApp(database, []).request(
      "/definitions",
      { headers: { "x-company-organization-id": "organization:default" } },
      {
        DB: binding,
      },
    )

    expect(allowed.status).toBe(200)
    expect(denied.status).toBe(403)
  })
})
