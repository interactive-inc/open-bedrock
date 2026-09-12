import { handleApiError } from "@/api/error-response/handle-api-error"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { companyRouteManifest } from "@/contexts/company/interface/route-manifest"
import { companySchema } from "@/contexts/company/infrastructure/schema/company"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { GET as gradeDefinitionsGET } from "@/contexts/company/interface/routes/company.grade-definitions"
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
  permissions: ReadonlyArray<"org:read" | "master:org:write">,
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
        capabilities: ["company:read"],
        permissions,
      }),
    )
    c.set("companyClock", () => new Date("2026-08-28T00:00:00.000Z"))
    await next()
  })
  app.get("/grade-definitions", ...gradeDefinitionsGET)
  return app
}

describe("Company等級定義の権限", () => {
  test("旧台帳は原記録の読み取りだけを公開し、履歴を伴わない書き込みを登録しない", () => {
    const legacy = companyRouteManifest.filter((route) =>
      [
        "/company/grade-definitions",
        "/company/position-definitions",
        "/company/employee-grades",
      ].some((path) => route.path === path || route.path.startsWith(`${path}/`)),
    )
    expect(legacy.map((route) => ({ method: route.method, path: route.path }))).toEqual([
      { method: "GET", path: "/company/employee-grades" },
      { method: "GET", path: "/company/grade-definitions" },
      { method: "GET", path: "/company/position-definitions" },
    ])
  })
  test("org:readがあればGETでき、なければ403になる", async () => {
    const { binding, database } = createTestDatabase()
    const allowed = await createApp(database, ["org:read"]).request(
      "/grade-definitions",
      undefined,
      { DB: binding },
    )
    const denied = await createApp(database, []).request("/grade-definitions", undefined, {
      DB: binding,
    })

    expect(allowed.status).toBe(200)
    expect(denied.status).toBe(403)
  })
})
