import { DirectPersonnelActionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/direct-personnel-action.adapter"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { drizzle } from "drizzle-orm/d1"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { createSystemD1TestDatabase } from "@system/test/create-system-d1-test-database.test-support"
import { InitialEmploymentPersistenceAdapter } from "@/contexts/company/infrastructure/adapters/employee/initial-employment-persistence.adapter"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import {
  GET as list,
  POST as create,
} from "@/contexts/software-license/interface/routes/software-license.software-licenses"
import {
  GET as detail,
  PUT as update,
} from "@/contexts/software-license/interface/routes/software-license.software-licenses.$id"
import { POST as cancel } from "@/contexts/software-license/interface/routes/software-license.software-licenses.$id.cancel"
import { GET as history } from "@/contexts/software-license/interface/routes/software-license.software-licenses.$id.history"
import { GET as assignments } from "@/contexts/software-license/interface/routes/software-license.software-licenses.assignments"
import { POST as assign } from "@/contexts/software-license/interface/routes/software-license.software-licenses.$id.assignments"
import { POST as release } from "@/contexts/software-license/interface/routes/software-license.software-licenses.assignments.$assignmentId.release"
import { licenseResponseSchema } from "@/contexts/software-license/interface/http/response-schemas"
import { HTTPException } from "hono/http-exception"

const schema = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
const secret = "software-license-integration-test-secret"

/** 両製品のmigrationと実認証・Company履歴を使う台帳fixture。 */
export async function createLicenseFixture() {
  const database = createSystemD1TestDatabase(schema)
  const settings: { enabled?: string; hiddenBindings?: boolean } = {}
  const clock = { now: new Date("2026-09-08T01:00:00Z") }
  const env = { DB: database, JWT_SECRET: secret, COMPANY_TIME_ZONE: "Asia/Tokyo" }
  await database.exec(`PRAGMA foreign_keys=ON;
    INSERT OR IGNORE INTO company_organizations (id,revision,name,representative_name,created_at,updated_at)
    VALUES ('organization:default',0,'Example',NULL,0,0);
    INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at)
    VALUES ('license-test-manager','license:test-manager','custom','LicenseEntity Manager',0,0);
    INSERT INTO system_iam_role_permissions (role_id,permission_key) VALUES
      ('license-test-manager','license:manage'),('license-test-manager','license:read:all');`)
  for (const suffix of ["manager", "member", "other"]) {
    await database
      .prepare(`INSERT INTO system_accounts (id,status,token_version,created_at,updated_at)
      VALUES (?1,'active',0,0,0)`)
      .bind(`account:${suffix}`)
      .run()
    await database
      .prepare(`INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at)
      VALUES (?1,?2,'human',?3,1,0,0)`)
      .bind(`principal:${suffix}`, `account:${suffix}`, suffix)
      .run()
    await database
      .prepare(`INSERT INTO company_employees (id,official_name,employee_code,email,phone,created_at,updated_at)
      VALUES (?1,?2,?3,NULL,NULL,0,0)`)
      .bind(`employee:${suffix}`, suffix, suffix.toUpperCase())
      .run()
    await database
      .prepare(`INSERT INTO company_employments (id,employee_id,contract_name,employment_type,hire_date,status,created_at,updated_at)
      VALUES (?1,?2,'Employment','FULL_TIME','2020-01-01','ACTIVE',0,0)`)
      .bind(`employment:${suffix}`, `employee:${suffix}`)
      .run()
    await database
      .prepare("INSERT INTO company_account_employee_links (account_id,employee_id) VALUES (?1,?2)")
      .bind(`account:${suffix}`, `employee:${suffix}`)
      .run()
    const initial = await new InitialEmploymentPersistenceAdapter({
      env,
      var: { database: drizzle(database) },
    }).prepare({
      employeeId: restoreWorkforceId("employee", `employee:${suffix}`),
      employmentId: restoreWorkforceId("employment", `employment:${suffix}`),
      effectiveOn: restoreCalendarDate("2020-01-01"),
      status: "active",
      occurredAt: new Date("2020-01-01T00:00:00Z"),
      actorAccountId: "account:manager",
      operationId: `initial:${suffix}`,
      reason: "Recorded employment",
    })
    if (initial instanceof Error) throw initial
    await database.batch([...initial])
  }
  await database.exec(`INSERT INTO system_role_bindings (id,account_id,role_id,created_at)
    VALUES ('license-test-binding','account:manager','license-test-manager',0);`)
  const app = softwareLicenseFactory
    .createApp()
    .use("*", async (c, next) => {
      c.set("now", () => clock.now)
      await next()
    })
    .onError((error, c) => {
      if (error instanceof HTTPException) return c.json({ message: error.message }, error.status)
      throw error
    })
    .get("/software-licenses", ...list)
    .post("/software-licenses", ...create)
    .get("/software-licenses/assignments", ...assignments)
    .post("/software-licenses/assignments/:assignmentId/release", ...release)
    .get("/software-licenses/:id/history", ...history)
    .get("/software-licenses/:id", ...detail)
    .put("/software-licenses/:id", ...update)
    .post("/software-licenses/:id/cancel", ...cancel)
    .post("/software-licenses/:id/assignments", ...assign)
  const request = async (
    path: string,
    options: Readonly<{
      method?: string
      body?: unknown
      actor?: string | null
      headers?: Record<string, string>
    }> = {},
  ) => {
    const token =
      options.actor === null
        ? null
        : await new SystemAccessTokenIssuer(secret).issue({
            accountId: zAccountId.parse(`account:${options.actor ?? "manager"}`),
            tokenVersion: 0,
            now: new Date(),
          })
    if (token instanceof Error) throw token
    const requestEnvironment = { ...env, SOFTWARE_LICENSE_ENABLED: settings.enabled }
    if (settings.hiddenBindings) {
      for (const key of ["DB", "COMPANY_TIME_ZONE"] as const)
        Object.defineProperty(requestEnvironment, key, { value: env[key], enumerable: false })
    }
    return app.request(
      path,
      {
        method: options.method ?? "GET",
        headers: {
          ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
          "content-type": "application/json",
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      },
      requestEnvironment,
    )
  }
  const created = await request("/software-licenses", {
    method: "POST",
    body: {
      name: "Example Service",
      plan_name: "Team",
      seats: 1,
      owner_employee_id: "employee:manager",
    },
  })
  if (created.status !== 201)
    throw new Error(`license fixture failed: ${created.status} ${await created.text()}`)
  const license = licenseResponseSchema.parse(await created.json())
  const retire = async (suffix: string) => {
    const employeeRevision = await database
      .prepare("SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id=?1")
      .bind(`employee:${suffix}`)
      .first<number>("revision")
    const organizationRevision = await database
      .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id=1")
      .first<number>("revision")
    if (employeeRevision === null || organizationRevision === null)
      throw new Error("missing lifecycle revision")
    const retired = await new DirectPersonnelActionAdapter({
      env: { ...env, NOW: clock.now.toISOString() },
      var: {
        database: drizzle(database),
        auditContext: {
          requestId: crypto.randomUUID(),
          clientName: "api",
          clientIp: null,
          externalRequestId: null,
        },
      },
    }).apply({
      session: {
        accountId: zAccountId.parse("account:manager"),
        employeeId: restoreWorkforceId("employee", "employee:manager"),
        hasPermission: () => true,
      },
      employeeId: restoreWorkforceId("employee", `employee:${suffix}`),
      idempotencyKey: `retire:${suffix}`,
      expectedEmployeeRevision: employeeRevision,
      expectedOrganizationRevision: organizationRevision,
      input: {
        kind: "retired",
        employeeCode: suffix.toUpperCase(),
        retirementOn: restoreCalendarDate("2026-09-07"),
      },
    })
    if (retired instanceof Error) throw retired
  }
  return { database, clock, settings, request, license, retire }
}
