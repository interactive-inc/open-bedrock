import { handleApiError } from "@/api/error-response/handle-api-error"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { companySchema } from "@/contexts/company/infrastructure/schema/company"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import {
  GET as gradeDefinitionsGET,
  POST as gradeDefinitionsPOST,
} from "@/contexts/company/interface/routes/company.grade-definitions"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { Hono } from "hono"
import { readFileSync } from "node:fs"

const companySql = readFileSync(
  new URL("../infrastructure/schema/company.sql", import.meta.url),
  "utf8",
)
const gradeDefinitionSql = `${companySql}
CREATE TABLE company_grade_definitions (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX uq_company_grade_definitions_code
  ON company_grade_definitions(code);`

function createTestDatabase() {
  const binding = createCompanyD1TestDatabase(gradeDefinitionSql)
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
  app.post("/grade-definitions", ...gradeDefinitionsPOST)
  return app
}

describe("Company等級定義の権限", () => {
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

  test("master:org:writeがあれば作成でき、org:readだけでは403になる", async () => {
    const { binding, database } = createTestDatabase()
    const input = {
      code: "G1",
      name: "等級1",
      rank: 1,
      description: "テスト等級",
    }
    const denied = await createApp(database, ["org:read"]).request(
      "/grade-definitions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
      { DB: binding },
    )
    const allowed = await createApp(database, ["master:org:write"]).request(
      "/grade-definitions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
      { DB: binding },
    )

    expect(denied.status).toBe(403)
    expect(allowed.status).toBe(201)
  })
})
