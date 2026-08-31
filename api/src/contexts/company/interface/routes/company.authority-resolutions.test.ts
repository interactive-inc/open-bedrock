import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { POST } from "@/contexts/company/interface/routes/company.authority-resolutions"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import type { SystemDatabase } from "@system/configuration/system-context"
import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"
import { readFileSync } from "node:fs"

const systemSql = readFileSync(
  new URL("../../../system/infrastructure/schema/system-core.sql", import.meta.url),
  "utf8",
)
const companySql = readFileSync(
  new URL("../../infrastructure/schema/company.sql", import.meta.url),
  "utf8",
)
const organizationId = "organization:authority-test"
const asOf = restoreCalendarDate("2026-01-01")

describe("Company authority resolution HTTP", () => {
  test("Company責務をliveなSystem Accountへ解決し、DB障害は候補なしへ畳まない", async () => {
    const database = createCompanyD1TestDatabase(`${systemSql}\n${companySql}`)
    await seed(database)
    const app = createApp()
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) => app.request(input, init, { DB: database })
    const client = hc<typeof app>("http://company.test", {
      fetch: request,
    })

    const resolved = await client.company["authority-resolutions"].$post({
      header: { "x-company-organization-id": organizationId },
      json: {
        as_of: asOf,
        subject_employee_id: null,
        criteria: [{ responsibility_code: "APPROVE", scope: null }],
      },
    })
    expect({ status: resolved.status, body: await resolved.json() }).toMatchObject({
      status: 200,
      body: {
        snapshot: { organizationRevision: 1 },
        candidates: [{ employeeId: "employee:active", accountId: "account:active" }],
      },
    })

    await database.exec("DROP TABLE system_accounts")
    const unavailable = await client.company["authority-resolutions"].$post({
      header: { "x-company-organization-id": organizationId },
      json: {
        as_of: asOf,
        subject_employee_id: null,
        criteria: [{ responsibility_code: "APPROVE", scope: null }],
      },
    })
    expect(Number(unavailable.status)).toBe(503)
    expect(await unavailable.json()).toMatchObject({ code: "company_read_unavailable" })
  })
})

function createApp() {
  return new Hono<CompanyHttpEnvironment>()
    .use("*", async (context, next) => {
      context.set(
        "companyActor",
        CompanyActorValue.restore({
          accountId: "account:active",
          employeeId: "employee:active",
          organizationIds: [organizationId],
          capabilities: ["company:read"],
        }),
      )
      context.set("database", {} as SystemDatabase)
      context.set("auditContext", {
        requestId: "authority-test",
        clientName: "system",
        clientIp: null,
        externalRequestId: null,
      })
      await next()
    })
    .onError((error, context) => {
      if (!(error instanceof CompanyHTTPException)) throw error
      return context.json({ code: error.code, detail: error.detail }, error.status)
    })
    .post("/company/authority-resolutions", ...POST)
}

async function seed(database: D1Database): Promise<void> {
  await database.exec(
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
     VALUES ('account:active', 'active', 0, 1, 1),
            ('account:suspended', 'suspended', 0, 1, 1);
     INSERT INTO company_organizations
       (id, revision, name, representative_name, created_at, updated_at)
     VALUES ('${organizationId}', 0, '', '', 1, 1);`,
  )
  const base = {
    organizationId,
    revision: 1,
    state: "active" as const,
    effectiveFrom: asOf,
    effectiveTo: null,
  }
  const resources: CompanyResourceProps[] = [
    {
      ...base,
      type: "responsibility",
      id: "responsibility:approve",
      attributes: { code: "APPROVE", officialName: "Approval" },
    },
  ]
  for (const state of ["active", "suspended"] as const) {
    resources.push(
      {
        ...base,
        type: "employee",
        id: `employee:${state}`,
        attributes: { personId: `person:${state}`, employeeCode: state.toUpperCase() },
      },
      {
        ...base,
        type: "employment",
        id: `employment:${state}`,
        attributes: { employeeId: `employee:${state}`, status: "ACTIVE" },
      },
      {
        ...base,
        type: "account-employee-link",
        id: `account-link:${state}`,
        attributes: { accountId: `account:${state}`, employeeId: `employee:${state}` },
      },
      {
        ...base,
        type: "responsibility-assignment",
        id: `responsibility-assignment:${state}`,
        attributes: {
          responsibilityId: "responsibility:approve",
          holderType: "employee",
          holderId: `employee:${state}`,
          authorityScopeId: null,
          delegationAllowed: false,
        },
      },
    )
  }
  const change = CompanyResourceChangeEntity.create({
    commandId: "command:authority-seed",
    expectedRevision: 0,
    actorAccountId: "account:active",
    reason: "authority test seed",
    recordedAt: 1,
    resources,
  })
  if (change instanceof Error) throw change
  const written = await new D1CompanyResourceRepository(database).write(change)
  if (written.kind !== "applied") throw new Error(`failed to seed: ${written.kind}`)
}
