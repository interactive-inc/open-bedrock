import { describe, expect, test } from "bun:test"
import type { CompanyActor } from "@/contexts/company/domain/core/company-actor"
import { POST as POST_ORGANIZATION_CHANGE } from "@/contexts/company/interface/routes/company.v1.organization-changes"
import { GET, POST } from "@/contexts/company/interface/routes/company.v1.people"
import {
  GET as GET_ORGANIZATION_PROFILE,
  PUT as PUT_ORGANIZATION_PROFILE,
} from "@/contexts/company/interface/routes/company.organization-profile"
import { CompanyHttpError } from "@/contexts/company/interface/http/errors/company-http-error"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { Hono } from "hono"
import { hc } from "hono/client"
import { readFileSync } from "node:fs"

const companySql = readFileSync(
  new URL("../infrastructure/schema/company.sql", import.meta.url),
  "utf8",
)

type TestEnv = {
  Bindings: { DB: D1Database }
  Variables: { companyActor: CompanyActor }
}

const actor: CompanyActor = {
  accountId: "account:1",
  employeeId: "employee:1",
  organizationIds: ["organization:default"],
  capabilities: ["company:read", "company:write"],
}

function createClient(database: D1Database, currentActor: CompanyActor = actor) {
  const app = new Hono<TestEnv>()
    .use("*", async (context, next) => {
      context.set("companyActor", currentActor)
      await next()
    })
    .onError((error, context) => {
      if (!(error instanceof CompanyHttpError)) throw error

      return context.json({ code: error.code, detail: error.detail }, error.status)
    })
    .get("/company/v1/people", ...GET)
    .post("/company/v1/people", ...POST)
    .post("/company/v1/organization-changes", ...POST_ORGANIZATION_CHANGE)
    .get("/company/organization-profile", ...GET_ORGANIZATION_PROFILE)
    .put("/company/organization-profile", ...PUT_ORGANIZATION_PROFILE)

  const request = (
    input: Parameters<typeof app.request>[0],
    init?: Parameters<typeof app.request>[1],
  ) => app.request(input, init, { DB: database })
  return hc<typeof app>("http://company.test", { fetch: request })
}

async function seedOrganization(database: D1Database): Promise<void> {
  await database
    .prepare(
      `INSERT INTO company_organizations
         (id, revision, name, representative_name, created_at, updated_at)
       VALUES (?, 0, '', '', 0, 0)`,
    )
    .bind("organization:default")
    .run()
}

const readHeaders = {
  "x-company-organization-id": "organization:default",
} as const

const writeHeaders = (commandId: string, expectedRevision: number) => ({
  "x-company-organization-id": "organization:default",
  "idempotency-key": commandId,
  "if-match": `"${expectedRevision}"`,
})

const person = {
  organizationId: "organization:default",
  type: "person",
  id: "person:1",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  attributes: { officialName: "Test Person" },
} as const

describe("canonical Company API", () => {
  test("法人プロフィールを設定するまでは404へ閉じ、設定後は同じorganizationから読める", async () => {
    const database = createCompanyD1TestDatabase(companySql)
    await seedOrganization(database)
    const client = createClient(database)

    const missing = await client.company["organization-profile"].$get()
    expect(Number(missing.status)).toBe(404)
    expect(await missing.json()).toMatchObject({ code: "organization_profile_not_configured" })

    const updated = await client.company["organization-profile"].$put({
      json: { name: "Example Corporation", representativeName: "Alex Example" },
    })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toEqual({
      name: "Example Corporation",
      representativeName: "Alex Example",
    })

    const read = await client.company["organization-profile"].$get()
    expect(read.status).toBe(200)
    expect(await read.json()).toEqual({
      name: "Example Corporation",
      representativeName: "Alex Example",
    })
  })

  test("Company write capabilityなしでは法人プロフィールを更新できない", async () => {
    const database = createCompanyD1TestDatabase(companySql)
    await seedOrganization(database)
    const client = createClient(database, { ...actor, capabilities: ["company:read"] })
    const response = await client.company["organization-profile"].$put({
      json: { name: "Example Corporation", representativeName: "Alex Example" },
    })

    expect(Number(response.status)).toBe(403)
    expect(await response.json()).toMatchObject({ code: "company_write_forbidden" })
  })

  test("write・replay・readを同じportable D1 contractで実行する", async () => {
    const client = createClient(createCompanyD1TestDatabase(companySql))
    const request = {
      header: writeHeaders("command:1", 0),
      json: { reason: "initial registration", resources: [person] },
    }

    const created = await client.company.v1.people.$post(request)
    expect(created.status).toBe(201)
    expect(created.headers.get("etag")).toBe('"1"')

    const replayed = await client.company.v1.people.$post(request)
    expect(replayed.status).toBe(200)
    expect(await replayed.json()).toMatchObject({ replayed: true, organizationRevision: 1 })

    const read = await client.company.v1.people.$get({ header: readHeaders, query: {} })
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject({
      organizationRevision: 1,
      resources: [person],
    })
  })

  test("同じidempotency keyの別commandを409へ閉じる", async () => {
    const client = createClient(createCompanyD1TestDatabase(companySql))
    const header = writeHeaders("command:1", 0)
    await client.company.v1.people.$post({
      header,
      json: { reason: "first", resources: [person] },
    })
    const conflict = await client.company.v1.people.$post({
      header,
      json: {
        reason: "different",
        resources: [{ ...person, attributes: { officialName: "Changed" } }],
      },
    })

    expect(Number(conflict.status)).toBe(409)
    expect(await conflict.json()).toMatchObject({ code: "company_command_conflict" })
  })

  test("People endpointは別resource型をschema境界で拒否する", async () => {
    const client = createClient(createCompanyD1TestDatabase(companySql))
    const response = await client.company.v1.people.$post({
      header: writeHeaders("command:wrong-resource", 0),
      json: {
        reason: "wrong endpoint",
        resources: [
          {
            ...person,
            // @ts-expect-error People endpoint only accepts person resources
            type: "employee",
          },
        ],
      },
    })

    expect(Number(response.status)).toBe(400)
    expect(await response.json()).toMatchObject({ code: "invalid_company_body" })
  })

  test("同じorganization revisionに固定して訂正・将来取消をas_ofで解決する", async () => {
    const client = createClient(createCompanyD1TestDatabase(companySql))
    type PersonResource = Parameters<
      typeof client.company.v1.people.$post
    >[0]["json"]["resources"][number]
    const write = (commandId: string, expectedRevision: number, resource: PersonResource) =>
      client.company.v1.people.$post({
        header: writeHeaders(commandId, expectedRevision),
        json: { reason: commandId, resources: [resource] },
      })

    expect((await write("command:initial", 0, person)).status).toBe(201)
    expect(
      (
        await write("command:rename", 1, {
          ...person,
          revision: 2,
          effectiveFrom: "2026-06-01",
          attributes: { officialName: "Renamed Person" },
        })
      ).status,
    ).toBe(201)
    expect(
      (
        await write("command:void", 2, {
          ...person,
          revision: 3,
          state: "void",
          effectiveFrom: "2026-09-01",
        })
      ).status,
    ).toBe(201)

    const beforeRename = await client.company.v1.people.$get({
      header: readHeaders,
      query: { as_of: "2026-03-01" },
    })
    expect(beforeRename.status).toBe(200)
    expect(await beforeRename.json()).toMatchObject({
      organizationRevision: 3,
      resources: [{ revision: 1, attributes: { officialName: "Test Person" } }],
    })

    const afterRename = await client.company.v1.people.$get({
      header: readHeaders,
      query: { effective_on: "2026-07-01" },
    })
    expect(afterRename.status).toBe(200)
    expect(await afterRename.json()).toMatchObject({
      organizationRevision: 3,
      resources: [{ revision: 2, attributes: { officialName: "Renamed Person" } }],
    })

    const afterVoid = await client.company.v1.people.$get({
      header: readHeaders,
      query: { as_of: "2026-10-01" },
    })
    expect(afterVoid.status).toBe(200)
    expect(await afterVoid.json()).toMatchObject({ organizationRevision: 3, resources: [] })
  })

  test("組織変更は上長関係の循環を永続化前に拒否する", async () => {
    const client = createClient(createCompanyD1TestDatabase(companySql))
    const organizationUnit = {
      organizationId: "organization:default",
      type: "organization-unit",
      id: "organization-unit-period:root",
      revision: 1,
      state: "active",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      attributes: {
        organizationUnitId: "organization-unit:root",
        code: "ROOT",
        officialName: "Company",
        kind: "COMPANY",
        parentOrganizationUnitId: null,
      },
    } as const
    const reportingRelation = (employeeId: string, managerEmployeeId: string) => ({
      organizationId: "organization:default",
      type: "reporting-relation" as const,
      id: `reporting:${employeeId}`,
      revision: 1,
      state: "active" as const,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      attributes: {
        employeeId,
        managerEmployeeId,
        organizationUnitId: "organization-unit:root",
      },
    })

    const response = await client.company.v1["organization-changes"].$post({
      header: writeHeaders("personnel-action:cycle", 0),
      json: {
        reason: "invalid management cycle",
        resources: [
          organizationUnit,
          reportingRelation("employee:1", "employee:2"),
          reportingRelation("employee:2", "employee:1"),
        ],
      },
    })

    expect(Number(response.status)).toBe(422)
    expect(await response.json()).toMatchObject({ code: "invalid_organization" })
  })

  test("hc request contractは不正なbody型をコンパイル時に拒否する", () => {
    const client = createClient(createCompanyD1TestDatabase(companySql))
    void ((input: Parameters<typeof client.company.v1.people.$post>[0]) => input)({
      header: writeHeaders("command:invalid", 0),
      // @ts-expect-error reason must be a string
      json: { reason: 1, resources: [person] },
    })
    void ((input: Parameters<typeof client.company.v1.people.$post>[0]) => input)({
      header: writeHeaders("command:wrong-resource", 0),
      json: {
        reason: "wrong endpoint",
        resources: [
          {
            ...person,
            // @ts-expect-error People endpoint only accepts person resources
            type: "employee",
          },
        ],
      },
    })
    void ((input: Parameters<(typeof client.company)["organization-profile"]["$put"]>[0]) => input)(
      {
        json: {
          // @ts-expect-error name must be a string
          name: 1,
          representativeName: "Alex Example",
        },
      },
    )
    expect(client.company.v1.people.$url()).toBeInstanceOf(URL)
  })
})
