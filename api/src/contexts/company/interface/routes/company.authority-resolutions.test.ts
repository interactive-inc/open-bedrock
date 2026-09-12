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
const principalSql = ["system-integration.sql", "system-principal.sql"]
  .map((name) =>
    readFileSync(new URL(`../../../system/infrastructure/schema/${name}`, import.meta.url), "utf8"),
  )
  .join("\n")
const organizationId = "organization:default"
const asOf = restoreCalendarDate("2026-01-01")

describe("Company authority resolution HTTP", () => {
  test("候補取得と期間照合の間の変更は409で拒否し、同じ照会を再試行できる", async () => {
    const database = createCompanyD1TestDatabase(`${systemSql}\n${principalSql}\n${companySql}`)
    await seed(database)
    const pending = new Set(["change"])
    const concurrent = new Proxy(database, {
      get(target, property) {
        if (property === "batch")
          return async (statements: D1PreparedStatement[]) => {
            const rows = await target.batch(statements)
            if (pending.delete("change")) {
              const change = CompanyResourceChangeEntity.create({
                commandId: "command:concurrent-authority",
                expectedRevision: 1,
                actorAccountId: "account:active",
                reason: "Confirmed responsibility correction",
                recordedAt: 2,
                resources: [
                  {
                    organizationId,
                    type: "responsibility",
                    id: "responsibility:approve",
                    revision: 2,
                    state: "active",
                    effectiveFrom: asOf,
                    effectiveTo: null,
                    attributes: { code: "APPROVE", officialName: "Corrected approval" },
                  },
                ],
              })
              if (change instanceof Error) throw change
              expect((await new D1CompanyResourceRepository(database).write(change)).kind).toBe(
                "applied",
              )
            }
            return rows
          }
        const value = Reflect.get(target, property)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
    const app = createApp()
    const request = () =>
      app.request(
        "/company/authority-resolutions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-company-organization-id": organizationId,
          },
          body: JSON.stringify({
            as_of: asOf,
            subject_employee_id: null,
            criteria: [{ responsibility_code: "APPROVE", scope: null }],
          }),
        },
        { DB: concurrent, NOW: "2026-01-01T00:00:00Z" },
      )
    const rejected = await request()
    expect(rejected.status).toBe(409)
    expect(await rejected.json()).toMatchObject({ code: "company_authority_snapshot_changed" })
    const retried = await request()
    expect(retried.status).toBe(200)
    expect(await retried.json()).toMatchObject({
      snapshot: { organizationRevision: 2 },
      candidates: [{ accountId: "account:active" }],
    })
  })

  test("公開Account対応が期間台帳に接続していなければ承認候補を返さない", async () => {
    const database = createCompanyD1TestDatabase(`${systemSql}\n${principalSql}\n${companySql}`)
    await seed(database)
    await database.exec("DROP TRIGGER company_account_employee_resource_bindings_delete_guard")
    await database.exec(
      "DELETE FROM company_account_employee_resource_bindings WHERE account_id = 'account:active'",
    )
    const response = await createApp().request(
      "/company/authority-resolutions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-company-organization-id": organizationId,
        },
        body: JSON.stringify({
          as_of: asOf,
          subject_employee_id: null,
          criteria: [{ responsibility_code: "APPROVE", scope: null }],
        }),
      },
      { DB: database, NOW: "2026-01-01T00:00:00Z" },
    )
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: "company_read_unavailable" })
  })

  test.each([
    { kind: "service", accountCreatedAt: 1, principalCreatedAt: 1 },
    { kind: "agent", accountCreatedAt: 1, principalCreatedAt: 1 },
    { kind: "missing", accountCreatedAt: 1, principalCreatedAt: 1 },
    { kind: "human", accountCreatedAt: 1, principalCreatedAt: 4102444800000 },
    { kind: "human", accountCreatedAt: 4102444800000, principalCreatedAt: 4102444800000 },
  ])("人間でない主体・未登録・判定後に作られる主体を承認候補へ含めない: %s", async (principal) => {
    const database = createCompanyD1TestDatabase(`${systemSql}\n${principalSql}\n${companySql}`)
    await seed(database, principal)
    const response = await createApp().request(
      "/company/authority-resolutions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-company-organization-id": organizationId,
        },
        body: JSON.stringify({
          as_of: asOf,
          subject_employee_id: null,
          criteria: [{ responsibility_code: "APPROVE", scope: null }],
        }),
      },
      { DB: database, NOW: "2026-01-01T00:00:00Z" },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ candidates: [] })
  })

  test("Company責務をliveなSystem Accountへ解決し、DB障害は候補なしへ畳まない", async () => {
    const database = createCompanyD1TestDatabase(`${systemSql}\n${principalSql}\n${companySql}`)
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

    await database.exec("PRAGMA foreign_keys = OFF")
    await database.exec("DROP TABLE system_accounts")
    await database.exec("PRAGMA foreign_keys = ON")
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
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
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
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code, detail: error.detail }, error.status)
  })
  return app.post("/company/authority-resolutions", ...POST)
}

async function seed(
  database: D1Database,
  principal = { kind: "human", accountCreatedAt: 1, principalCreatedAt: 1 },
): Promise<void> {
  await database.exec(
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
     VALUES ('account:active', 'active', 0, ${principal.accountCreatedAt}, ${principal.accountCreatedAt}),
            ('account:suspended', 'suspended', 0, 1, 1);
     INSERT INTO company_organizations
       (id, revision, name, representative_name, created_at, updated_at)
     VALUES ('${organizationId}', 0, '', '', 1, 1);`,
  )
  if (principal.kind !== "missing")
    await database
      .prepare(`INSERT INTO system_principals (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
      VALUES ('principal:active', 'account:active', ?, 'Example Human', NULL, 1, ?, ?)`)
      .bind(principal.kind, principal.principalCreatedAt, principal.principalCreatedAt)
      .run()
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
        type: "person",
        id: `person:${state}`,
        attributes: { officialName: `Example ${state}` },
      },
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
        attributes: {
          employeeId: `employee:${state}`,
          status: "ACTIVE",
          employmentType: "FULL_TIME",
        },
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
