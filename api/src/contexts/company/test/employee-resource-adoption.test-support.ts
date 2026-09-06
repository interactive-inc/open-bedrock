import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { Hono } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import type { SystemRequestAudit } from "@system/configuration/system-context"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { InitialEmploymentPersistenceAdapter } from "@/contexts/company/infrastructure/adapters/employee/initial-employment-persistence.adapter"
import { DirectPersonnelActionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/direct-personnel-action.adapter"
import {
  companyAuthenticatedRoutes,
  companyAuditedRoutes,
} from "@/contexts/company/interface/routes/company"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
export type AdoptionResource = {
  organizationId: string
  type: "person" | "employee" | "employment"
  id: string
  revision: number
  state: "active" | "void"
  effectiveFrom: string
  effectiveTo: string | null
  attributes: Record<string, string | null>
}
export const adoptionEmployeeId = restoreWorkforceId("employee", "employee:adoption")
const employmentId = restoreWorkforceId("employment", "employment:adoption")
const actor = CompanyActorValue.restore({
  accountId: "account:adoption",
  employeeId: adoptionEmployeeId,
  organizationIds: ["organization:default"],
  capabilities: ["company:admin"],
})

/** 保存済み台帳だけの従業員を実際の期間・発令機構で準備する。 */
export async function createEmployeeAdoptionFixture() {
  const database = createCompanyD1TestDatabase(schemaSql)
  const clock = { now: new Date("2026-09-07T00:00:00Z") }
  const actors: { current: CompanyActorValue | undefined } = { current: actor }
  const environment = { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo" }
  const audit: SystemRequestAudit = {
    requestId: crypto.randomUUID(),
    clientName: "api",
    clientIp: null,
    externalRequestId: null,
  }
  await database.exec(`INSERT INTO company_organizations (id, revision, name, representative_name, created_at, updated_at)
    VALUES ('organization:default', 0, 'Example', 'Example', 0, 0);
    INSERT INTO company_employees (id, official_name, employee_code, email, phone, created_at, updated_at)
    VALUES ('employee:adoption', 'Current Person', 'ADOPT-001', 'you@example.com', NULL, 0, 0);
    INSERT INTO company_employments (id, employee_id, contract_name, employment_type, hire_date, termination_date, status, created_at, updated_at)
    VALUES ('employment:adoption', 'employee:adoption', 'Confirmed Contract', 'PART_TIME', '2020-01-01', NULL, 'ACTIVE', 0, 0);
    INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('account:adoption', 'active', 0, 0, 0);
    INSERT INTO company_account_employee_links (account_id, employee_id) VALUES ('account:adoption', 'employee:adoption');
    INSERT INTO company_account_profiles (organization_id, account_id, display_name, created_at, updated_at)
    VALUES ('organization:default', 'account:adoption', 'Current Person', 0, 0);`)
  const initial = await new InitialEmploymentPersistenceAdapter({
    env: environment,
    var: { database: drizzle(database) },
  }).prepare({
    employeeId: adoptionEmployeeId,
    employmentId,
    effectiveOn: restoreCalendarDate("2020-01-01"),
    status: "active",
    occurredAt: new Date("2020-01-01T00:00:00Z"),
    actorAccountId: actor.accountId,
    operationId: "legacy-initial",
    reason: "Confirmed historical registration",
  })
  if (initial instanceof Error) throw initial
  await database.batch([...initial])
  const personnel = async (input: PersonnelActionInput, key: string) => {
    const employeeRevision = await database
      .prepare("SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = ?1")
      .bind(adoptionEmployeeId)
      .first<number>("revision")
    const organizationRevision = await database
      .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
      .first<number>("revision")
    if (employeeRevision === null || organizationRevision === null)
      throw new Error("missing lifecycle revision")
    return new DirectPersonnelActionAdapter({
      env: { ...environment, NOW: clock.now.toISOString() },
      var: { database: drizzle(database), auditContext: audit },
    }).apply({
      session: {
        accountId: zAccountId.parse(actor.accountId),
        employeeId: adoptionEmployeeId,
        hasPermission: (permission) => permission === "employee:lifecycle:apply",
      },
      employeeId: adoptionEmployeeId,
      idempotencyKey: key,
      expectedEmployeeRevision: employeeRevision,
      expectedOrganizationRevision: organizationRevision,
      input,
    })
  }
  const leave = await personnel(
    {
      kind: "leave_started",
      employeeCode: "ADOPT-001",
      eventOn: restoreCalendarDate("2026-08-01"),
    },
    "legacy-leave",
  )
  if (leave instanceof Error) throw leave
  const person: AdoptionResource = {
    organizationId: "organization:default",
    type: "person",
    id: "person:adoption",
    revision: 1,
    state: "active",
    effectiveFrom: "2020-01-01",
    effectiveTo: null,
    attributes: { officialName: "Former Person" },
  }
  const resources: AdoptionResource[] = [
    person,
    {
      ...person,
      revision: 2,
      effectiveFrom: "2024-01-01",
      attributes: { officialName: "Current Person", email: "you@example.com", phone: null },
    },
    {
      ...person,
      type: "employee",
      id: adoptionEmployeeId,
      attributes: { personId: person.id, employeeCode: "ADOPT-001" },
    },
    {
      ...person,
      type: "employment",
      id: employmentId,
      attributes: {
        employeeId: adoptionEmployeeId,
        employmentType: "PART_TIME",
        officialName: "Confirmed Contract",
        status: "ACTIVE",
      },
    },
    {
      ...person,
      type: "employment",
      id: employmentId,
      revision: 2,
      effectiveFrom: "2026-08-01",
      attributes: {
        employeeId: adoptionEmployeeId,
        employmentType: "PART_TIME",
        officialName: "Confirmed Contract",
        status: "ON_LEAVE",
      },
    },
  ]
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (c, next) => {
    c.set("companyActor", actors.current)
    c.set("companyClock", () => clock.now)
    c.set("database", drizzle(database))
    c.set("auditContext", audit)
    await next()
  })
  app.onError((error, c) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return c.json({ code: error.code }, error.status)
  })
  app.route("/company", companyAuthenticatedRoutes).route("/company", companyAuditedRoutes)
  const read = () =>
    app.request(
      "/company/employee-resource-adoptions?employee_id=employee:adoption",
      {},
      environment,
    )
  const input = async () => {
    const response = await read()
    if (response.status !== 200) throw new Error(`snapshot failed: ${response.status}`)
    return {
      ...z
        .object({
          expectedRevision: z.number(),
          snapshotDigest: z.string(),
          observedOn: z.string(),
        })
        .parse(await response.json()),
      employeeId: adoptionEmployeeId,
      reason: "Confirmed against personnel records",
      resources,
    }
  }
  const post = (body: unknown, key = "adoption-command") =>
    app.request(
      "/company/employee-resource-adoptions",
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify(body),
      },
      environment,
    )
  const legacy = async () =>
    Promise.all(
      [
        "company_employees",
        "company_employments",
        "company_personnel_actions",
        "company_employment_period_versions",
        "company_employee_status_period_versions",
        "company_employee_lifecycle_revisions",
        "company_account_employee_links",
        "company_account_profiles",
      ].map(
        async (table) =>
          (await database.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all()).results,
      ),
    )
  return {
    database,
    clock,
    actors,
    actor,
    app,
    environment,
    read,
    input,
    post,
    resources,
    legacy,
    personnel,
  }
}
