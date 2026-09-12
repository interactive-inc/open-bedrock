import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { Hono } from "hono"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { GET as GET_0 } from "@/contexts/company/interface/routes/company.people"
import { GET as GET_1 } from "@/contexts/company/interface/routes/company.employees"
import { GET as GET_2 } from "@/contexts/company/interface/routes/company.employments"
import { GET as GET_3 } from "@/contexts/company/interface/routes/company.profile"
import { GET as GET_4 } from "@/contexts/company/interface/routes/company.account-employee-links"
import { GET as GET_5 } from "@/contexts/company/interface/routes/company.legacy-personnel-action-records"

test("会社の各台帳は同じ会社版で取得でき、遡及更新後も旧版の内容と有効期間を保つ", async () => {
  const database = createCompanyD1TestDatabase(
    readFileSync(
      new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
      "utf8",
    ) +
      "\n" +
      readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8"),
  )
  await database.exec(
    "INSERT INTO system_accounts (id, status, created_at, updated_at) VALUES ('account:test', 'active', 0, 0)",
  )
  const repository = new D1CompanyResourceRepository(database)
  const specifications: Pick<CompanyResourceProps, "type" | "id" | "attributes">[] = [
    { type: "person", id: "person:test", attributes: { officialName: "Person" } },
    {
      type: "employee",
      id: "employee:test",
      attributes: { personId: "person:test", employeeCode: "E001" },
    },
    {
      type: "employment",
      id: "employment:test",
      attributes: { employeeId: "employee:test", status: "ACTIVE", employmentType: "FULL_TIME" },
    },
    {
      type: "company-profile",
      id: "profile:test",
      attributes: {
        displayName: "Company",
        locale: "en",
        timeZone: "UTC",
        fiscalYearStartMonth: 1,
      },
    },
    {
      type: "account-employee-link",
      id: "link:test",
      attributes: { employeeId: "employee:test", accountId: "account:test" },
    },
    { type: "personnel-action", id: "action:test", attributes: { actionType: "HIRE" } },
  ]
  for (const revision of [1, 2]) {
    const command = CompanyResourceChangeEntity.create({
      commandId: `resource-snapshot:${revision}`,
      expectedRevision: revision - 1,
      actorAccountId: "account:operator",
      reason: "Confirmed record correction",
      recordedAt: revision,
      resources: specifications.map((specification) => ({
        ...specification,
        organizationId: "organization:default",
        revision,
        state: "active",
        effectiveFrom: restoreCalendarDate("2030-01-01"),
        effectiveTo: revision === 1 ? null : restoreCalendarDate("2030-07-01"),
      })),
    })
    if (command instanceof Error) throw command
    expect(await repository.write(command)).toMatchObject({ kind: "applied" })
  }
  const state = { authorized: true }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    context.set("companyClock", () => new Date("2030-06-01T00:00:00Z"))
    context.set(
      "companyActor",
      CompanyActorValue.restore({
        accountId: "account:reader",
        employeeId: null,
        organizationIds: [state.authorized ? "organization:default" : "organization:other"],
        capabilities: ["company:read"],
      }),
    )
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  app.get("/people", ...GET_0)
  app.get("/employees", ...GET_1)
  app.get("/employments", ...GET_2)
  app.get("/profile", ...GET_3)
  app.get("/account-employee-links", ...GET_4)
  app.get("/legacy-personnel-action-records", ...GET_5)
  for (const path of [
    "people",
    "employees",
    "employments",
    "profile",
    "account-employee-links",
    "legacy-personnel-action-records",
  ]) {
    const headers = { "x-company-organization-id": "organization:default" }
    for (const revision of [1, 2]) {
      const response = await app.request(
        `/${path}?organization_revision=${revision}&effective_on=2030-06-01`,
        { headers },
        { DB: database, COMPANY_TIME_ZONE: "UTC" },
      )
      expect(response.status).toBe(200)
      expect(response.headers.get("etag")).toBe(`"${revision}"`)
      expect(await response.json()).toMatchObject({
        organizationRevision: revision,
        resources: [{ revision }],
      })
    }
    for (const revision of [0, 1, 2]) {
      const response = await app.request(
        `/${path}?organization_revision=${revision}&effective_on=2030-08-01`,
        { headers },
        { DB: database, COMPANY_TIME_ZONE: "UTC" },
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        organizationRevision: revision,
        resources: revision === 1 ? [{ revision: 1 }] : [],
      })
    }
    for (const revision of ["3", "-1", "1.5", "9007199254740992", "invalid"]) {
      const response = await app.request(
        `/${path}?organization_revision=${revision}`,
        { headers },
        { DB: database, COMPANY_TIME_ZONE: "UTC" },
      )
      expect(response.status).toBe(400)
    }
    state.authorized = false
    const forbidden = await app.request(
      `/${path}?organization_revision=3`,
      { headers },
      { DB: database, COMPANY_TIME_ZONE: "UTC" },
    )
    expect(forbidden.status).toBe(403)
    state.authorized = true
  }
})
