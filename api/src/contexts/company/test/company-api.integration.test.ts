import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { readFileSync } from "node:fs"
import type { CompanyActor } from "@/contexts/company/application/core/company-resource.service"
import { GET, POST } from "@/contexts/company/interface/routes/company/v1/people/route"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

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

function createApp(database: D1Database) {
  const app = new Hono<TestEnv>()
  app.use("*", async (context, next) => {
    context.set("companyActor", actor)
    await next()
  })
  app.get("/company/v1/people", ...GET)
  app.post("/company/v1/people", ...POST)
  return (path: string, init?: RequestInit) => app.request(path, init, { DB: database })
}

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
  test("write・replay・readを同じportable D1 contractで実行する", async () => {
    const request = createApp(createCompanyD1TestDatabase(companySql))
    const init = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-company-organization-id": "organization:default",
        "idempotency-key": "command:1",
        "if-match": '"0"',
      },
      body: JSON.stringify({ reason: "initial registration", resources: [person] }),
    }

    const created = await request("/company/v1/people", init)
    expect(created.status).toBe(201)
    expect(created.headers.get("etag")).toBe('"1"')

    const replayed = await request("/company/v1/people", init)
    expect(replayed.status).toBe(200)
    expect(await replayed.json()).toMatchObject({ replayed: true, organizationRevision: 1 })

    const read = await request("/company/v1/people", {
      headers: { "x-company-organization-id": "organization:default" },
    })
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject({
      organizationRevision: 1,
      resources: [person],
    })
  })

  test("同じidempotency keyの別commandを409へ閉じる", async () => {
    const request = createApp(createCompanyD1TestDatabase(companySql))
    const headers = {
      "content-type": "application/json",
      "x-company-organization-id": "organization:default",
      "idempotency-key": "command:1",
      "if-match": '"0"',
    }
    await request("/company/v1/people", {
      method: "POST",
      headers,
      body: JSON.stringify({ reason: "first", resources: [person] }),
    })
    const conflict = await request("/company/v1/people", {
      method: "POST",
      headers,
      body: JSON.stringify({
        reason: "different",
        resources: [{ ...person, attributes: { officialName: "Changed" } }],
      }),
    })

    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toMatchObject({ code: "company_command_conflict" })
  })

  test("同じorganization revisionに固定して訂正・将来取消をas_ofで解決する", async () => {
    const request = createApp(createCompanyD1TestDatabase(companySql))
    const write = async (commandId: string, expectedRevision: number, resource: object) =>
      request("/company/v1/people", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-company-organization-id": "organization:default",
          "idempotency-key": commandId,
          "if-match": `"${expectedRevision}"`,
        },
        body: JSON.stringify({ reason: commandId, resources: [resource] }),
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

    const beforeRename = await request("/company/v1/people?as_of=2026-03-01", {
      headers: { "x-company-organization-id": "organization:default" },
    })
    expect(beforeRename.status).toBe(200)
    expect(await beforeRename.json()).toMatchObject({
      organizationRevision: 3,
      resources: [{ revision: 1, attributes: { officialName: "Test Person" } }],
    })

    const afterRename = await request("/company/v1/people?effective_on=2026-07-01", {
      headers: { "x-company-organization-id": "organization:default" },
    })
    expect(afterRename.status).toBe(200)
    expect(await afterRename.json()).toMatchObject({
      organizationRevision: 3,
      resources: [{ revision: 2, attributes: { officialName: "Renamed Person" } }],
    })

    const afterVoid = await request("/company/v1/people?as_of=2026-10-01", {
      headers: { "x-company-organization-id": "organization:default" },
    })
    expect(afterVoid.status).toBe(200)
    expect(await afterVoid.json()).toMatchObject({ organizationRevision: 3, resources: [] })
  })
})
