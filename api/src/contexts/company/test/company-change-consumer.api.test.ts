import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { Hono } from "hono"
import { z } from "zod"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { GET as changes } from "@/contexts/company/interface/routes/company.changes"
import { GET as people } from "@/contexts/company/interface/routes/company.people"
import { GET as employees } from "@/contexts/company/interface/routes/company.employees"
import { GET as employments } from "@/contexts/company/interface/routes/company.employments"
import { GET as profile } from "@/contexts/company/interface/routes/company.profile"

import { GET as organizationSnapshots } from "@/contexts/company/interface/routes/company.organization-snapshots"
import { GET as definitions } from "@/contexts/company/interface/routes/company.definitions"

const resourceSchema = z.object({
  id: z.string(),
  type: z.string(),
  revision: z.number(),
  state: z.enum(["active", "void"]),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
})
const snapshotSchema = z.object({
  organizationRevision: z.number(),
  resources: z.array(resourceSchema),
})
const pageSchema = z.object({
  data: z.array(z.object({ resource_type: z.string(), resource_id: z.string() })),
  through_revision: z.number(),
  next_cursor: z.string(),
  has_more: z.boolean(),
})
const consumerSchema = z.object({
  cursor: z.string().nullable(),
  throughRevision: z.number().nullable(),
  publishedRevision: z.number(),
  published: z.record(z.string(), resourceSchema),
  staged: z.record(z.string(), resourceSchema),
})
const paths = new Map([
  ["person", "people"],
  ["employee", "employees"],
  ["employment", "employments"],
  ["company-profile", "profile"],
  ["organization-unit", "organization-snapshots"],
  ["assignment", "organization-snapshots"],
  ["responsibility-assignment", "organization-snapshots"],
  ["responsibility", "definitions"],
  ["authority-scope", "definitions"],
])

function consumer() {
  return consumerSchema.parse({
    cursor: null,
    throughRevision: null,
    publishedRevision: 0,
    published: {},
    staged: {},
  })
}

function fixture() {
  const database = createCompanyD1TestDatabase(
    readFileSync(
      new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
      "utf8",
    ) +
      "\n" +
      readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8"),
  )
  const repository = new D1CompanyResourceRepository(database)
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    context.set(
      "companyActor",
      CompanyActorValue.restore({
        accountId: "account:reader",
        employeeId: null,
        organizationIds: ["organization:default"],
        capabilities: ["company:read"],
      }),
    )
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  app.get("/changes", ...changes)
  app.get("/people", ...people)
  app.get("/employees", ...employees)
  app.get("/employments", ...employments)
  app.get("/profile", ...profile)
  app.get("/organization-snapshots", ...organizationSnapshots)
  app.get("/definitions", ...definitions)
  return {
    async write(revision: number, resources: CompanyResourceProps[]) {
      const command = CompanyResourceChangeEntity.create({
        commandId: `consumer:${revision}`,
        expectedRevision: revision - 1,
        actorAccountId: "account:operator",
        reason: "Confirmed correction",
        recordedAt: revision,
        resources,
      })
      if (command instanceof Error) throw command
      expect(await repository.write(command)).toMatchObject({ kind: "applied" })
    },
    async request(this: void, path: string) {
      const response = await app.request(
        path,
        {
          headers: { "x-company-organization-id": "organization:default" },
        },
        { DB: database, COMPANY_TIME_ZONE: "UTC" },
      )
      expect(response.status).toBe(200)
      return response.json()
    },
  }
}

function resources(revision: number): CompanyResourceProps[] {
  const base = {
    organizationId: "organization:default",
    revision,
    effectiveFrom: restoreCalendarDate("2030-01-01"),
    effectiveTo: null,
  }
  return [
    {
      ...base,
      state: "active",
      type: "person",
      id: "person:test",
      attributes: { officialName: revision === 1 ? "Original name" : "Corrected name" },
    },
    {
      ...base,
      state: "active",
      type: "employee",
      id: "employee:test",
      attributes: { personId: "person:test", employeeCode: "E001" },
    },
    {
      ...base,
      state: "active",
      type: "employment",
      id: "employment:test",
      effectiveTo: revision === 1 ? null : restoreCalendarDate("2030-10-01"),
      attributes: { employeeId: "employee:test", status: "ACTIVE", employmentType: "FULL_TIME" },
    },
    {
      ...base,
      state: "active",
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
      ...base,
      state: "active",
      type: "organization-unit",
      id: "period:root",
      attributes: {
        organizationUnitId: "unit:root",
        code: "ROOT",
        officialName: "Root",
        kind: "COMPANY",
        parentOrganizationUnitId: null,
      },
    },
    {
      ...base,
      state: "active",
      type: "assignment",
      id: "assignment:test",
      effectiveTo: revision === 1 ? null : restoreCalendarDate("2030-10-01"),
      attributes: {
        employeeId: "employee:test",
        employmentId: "employment:test",
        organizationUnitId: "unit:root",
        assignmentType: "PRIMARY",
        positionTitle: revision === 1 ? "Member" : "Coordinator",
      },
    },
    {
      ...base,
      state: "active",
      type: "responsibility",
      id: "responsibility:approve",
      attributes: { code: "APPROVE", officialName: "Approval" },
    },
    {
      ...base,
      state: "active",
      type: "authority-scope",
      id: "scope:amount",
      attributes: {
        scopeType: "amount",
        currencyCode: "JPY",
        minimumAmount: 100,
        maximumAmount: 1000,
      },
    },
    {
      ...base,
      state: "active",
      type: "responsibility-assignment",
      id: "assignment:approve",
      effectiveTo: revision === 1 ? null : restoreCalendarDate("2030-10-01"),
      attributes: {
        responsibilityId: "responsibility:approve",
        holderType: "employee",
        holderId: "employee:test",
        authorityScopeId: "scope:amount",
        delegationAllowed: revision === 1,
      },
    },
  ]
}

async function advance(props: {
  request: ReturnType<typeof fixture>["request"]
  consumer: z.infer<typeof consumerSchema>
  limit: number
  effectiveOn: string
}) {
  const state = props.consumer
  const query = new URLSearchParams({ limit: String(props.limit) })
  if (state.cursor !== null) query.set("cursor", state.cursor)
  if (state.throughRevision !== null) query.set("through_revision", String(state.throughRevision))
  const page = pageSchema.parse(await props.request(`/changes?${query.toString()}`))
  state.throughRevision = page.through_revision
  for (const change of page.data) {
    const path = paths.get(change.resource_type)
    if (path === undefined) throw new Error("Unmapped Company resource")
    const snapshot = snapshotSchema.parse(
      await props.request(
        `/${path}?${new URLSearchParams({
          id: change.resource_id,
          organization_revision: String(page.through_revision),
          effective_on: props.effectiveOn,
        }).toString()}`,
      ),
    )
    expect(snapshot.organizationRevision).toBe(page.through_revision)
    const key = `${change.resource_type}:${change.resource_id}`
    delete state.staged[key]
    for (const resource of snapshot.resources) {
      if (resource.type === change.resource_type && resource.id === change.resource_id)
        state.staged[key] = resource
    }
  }
  state.cursor = page.next_cursor
  if (!page.has_more) {
    state.published = structuredClone(state.staged)
    state.publishedRevision = page.through_revision
    state.throughRevision = null
  }
  return page.has_more
}

async function complete(props: Parameters<typeof advance>[0]) {
  for (const attempt of Array.from({ length: 100 }, (_, index) => index)) {
    if (!(await advance(props))) return
    expect(attempt).toBeLessThan(99)
  }
  throw new Error("Company feed did not complete")
}

async function snapshot(props: {
  request: ReturnType<typeof fixture>["request"]
  revision: number
  effectiveOn: string
}) {
  const collected: z.infer<typeof consumerSchema>["published"] = {}
  for (const path of new Set(paths.values())) {
    const response = snapshotSchema.parse(
      await props.request(
        `/${path}?${new URLSearchParams({
          organization_revision: String(props.revision),
          effective_on: props.effectiveOn,
        }).toString()}`,
      ),
    )
    expect(response.organizationRevision).toBe(props.revision)
    for (const resource of response.resources)
      collected[`${resource.type}:${resource.id}`] = resource
  }
  return collected
}

test("独立した利用者が変更APIと公開台帳だけで属性・期間を再構築し、中断中の会社版を公開しない", async () => {
  const f = fixture()
  await f.write(1, resources(1))
  await f.write(2, resources(2))
  const first = consumer()
  const second = consumer()
  const request = f.request
  const effectiveOn = "2030-06-01"
  expect(await advance({ request, consumer: first, limit: 1, effectiveOn })).toBe(true)
  expect(first.publishedRevision).toBe(0)
  expect(first.published).toEqual({})
  expect(first.throughRevision).toBe(2)
  const resumed = consumerSchema.parse(JSON.parse(JSON.stringify(first)))
  await f.write(3, [
    {
      ...resources(2)[0]!,
      revision: 3,
      effectiveFrom: restoreCalendarDate("2030-07-01"),
      attributes: { officialName: "Future name" },
    },
  ])
  await complete({ request, consumer: resumed, limit: 1, effectiveOn })
  expect(resumed.publishedRevision).toBe(2)
  expect(resumed.published).toEqual(await snapshot({ request, revision: 2, effectiveOn }))
  expect(resumed.published["person:person:test"]?.attributes).toEqual({
    officialName: "Corrected name",
  })
  expect(resumed.published["employment:employment:test"]?.effectiveTo).toBe("2030-10-01")
  expect(resumed.published["assignment:assignment:test"]?.attributes.positionTitle).toBe(
    "Coordinator",
  )
  expect(
    resumed.published["responsibility-assignment:assignment:approve"]?.attributes.delegationAllowed,
  ).toBe(false)
  await complete({ request, consumer: resumed, limit: 2, effectiveOn })
  await complete({ request, consumer: second, limit: 3, effectiveOn })
  expect(resumed.publishedRevision).toBe(3)
  expect(second.published).toEqual(resumed.published)
  expect(second.published).toEqual(await snapshot({ request, revision: 3, effectiveOn }))
  const saved = structuredClone(second)
  await complete({ request, consumer: second, limit: 3, effectiveOn })
  expect(second).toEqual(saved)
})

test("変更を受信した日と発効日を分け、将来発効・遡及訂正・取消を会社版に固定して取得する", async () => {
  const f = fixture()
  await f.write(1, resources(1))
  await f.write(2, resources(2))
  await f.write(3, [
    {
      ...resources(2)[0]!,
      revision: 3,
      effectiveFrom: restoreCalendarDate("2030-07-01"),
      attributes: { officialName: "Future name" },
    },
  ])
  await f.write(4, [{ ...resources(2)[3]!, revision: 3, state: "void" }])
  for (const effectiveOn of ["2030-06-01", "2030-08-01", "2030-11-01"]) {
    const state = consumer()
    await complete({ request: f.request, consumer: state, limit: 2, effectiveOn })
    expect(state.publishedRevision).toBe(4)
    expect(state.published).toEqual(
      await snapshot({ request: f.request, revision: 4, effectiveOn }),
    )
    expect(state.published["company-profile:profile:test"]).toBeUndefined()
    expect(state.published["person:person:test"]?.attributes.officialName).toBe(
      effectiveOn === "2030-06-01" ? "Corrected name" : "Future name",
    )
    expect(state.published["employment:employment:test"] === undefined).toBe(
      effectiveOn === "2030-11-01",
    )
  }
  const old = await snapshot({ request: f.request, revision: 1, effectiveOn: "2030-11-01" })
  expect(old["person:person:test"]?.attributes.officialName).toBe("Original name")
  expect(old["employment:employment:test"]?.effectiveTo).toBeNull()
  expect(old["company-profile:profile:test"]).toBeDefined()
})
