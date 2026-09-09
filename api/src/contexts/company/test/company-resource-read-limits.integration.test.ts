import { expect, test } from "bun:test"
import { Hono } from "hono"
import { readFileSync } from "node:fs"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { GET as PEOPLE_GET } from "@/contexts/company/interface/routes/company.people"
import { GET as DEFINITIONS_GET } from "@/contexts/company/interface/routes/company.definitions"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

const schema =
  readFileSync(
    new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
    "utf8",
  ) +
  "\n" +
  readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8")
const organizationId = "organization:default"
const day = restoreCalendarDate("2026-01-01")

/** HTTP の100件契約を実DBと同じパラメータ上限で検査する。 */
async function fixture(type: "person" | "grade") {
  const database = createCompanyD1TestDatabase(schema)
  const repository = new D1CompanyResourceRepository(database)
  const resources: CompanyResourceProps[] = Array.from(
    { length: 100 },
    (_, index): CompanyResourceProps => ({
      organizationId,
      type,
      id: `${type}:${String(index).padStart(3, "0")}`,
      revision: 1,
      state: "active",
      effectiveFrom: day,
      effectiveTo: null,
      attributes:
        type === "person"
          ? { officialName: `Person ${index}` }
          : { code: `GRADE_${index}`, officialName: `Grade ${index}` },
    }),
  )
  for (const [revision, records] of [
    [0, resources],
    [1, [{ ...resources[0], id: `${type}:excluded` }]],
  ] as const) {
    const command = CompanyResourceChangeEntity.create({
      resources: records,
      expectedRevision: revision,
      commandId: `read-limits:${revision}`,
      actorAccountId: "account:operator",
      reason: "Register confirmed records",
      recordedAt: 1,
    })
    if (command instanceof Error) throw command
    expect(await repository.write(command)).toMatchObject({ kind: "applied" })
  }
  const prepare = database.prepare.bind(database)
  const bindCounts: number[] = []
  database.prepare = (query) => {
    const statement = prepare(query)
    const bind = statement.bind.bind(statement)
    statement.bind = (...values: unknown[]) => {
      bindCounts.push(values.length)
      if (values.length > 100) throw new Error("D1 bind limit exceeded")
      return bind(...values)
    }
    return statement
  }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (c, next) => {
    c.set(
      "companyActor",
      CompanyActorValue.restore({
        accountId: "account:reader",
        employeeId: null,
        organizationIds: [organizationId],
        capabilities: ["company:read"],
      }),
    )
    await next()
  })
  app.onError((error, c) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return c.json({ code: error.code }, error.status)
  })
  app.get("/company/people", ...PEOPLE_GET).get("/company/definitions", ...DEFINITIONS_GET)
  const request = (ids: string[], effectiveOn: string | null, company = organizationId) => {
    const query = new URLSearchParams(ids.map((id): [string, string] => ["id", id]))
    if (effectiveOn !== null) query.set("effective_on", effectiveOn)
    return app.request(
      `/company/${type === "person" ? "people" : "definitions"}?${query.toString()}`,
      {
        headers: { "x-company-organization-id": company },
      },
      { DB: database },
    )
  }
  return { request, resources, bindCounts }
}

test.each(["person", "grade"] as const)(
  "%sを100件指定したHTTP照会は日付指定と併用できる",
  async (type) => {
    const f = await fixture(type)
    const ids = f.resources.map((resource) => resource.id)
    for (const date of [null, day]) {
      const response = await f.request(ids, date)
      expect(response.status).toBe(200)
      expect(response.headers.get("etag")).toBe('"2"')
      const body: unknown = await response.json()
      expect(body).toEqual({
        organizationId,
        organizationRevision: 2,
        resources: f.resources,
      })
    }
    expect(Math.max(...f.bindCounts)).toBeLessThanOrEqual(7)
    expect((await f.request([...ids, `${type}:excluded`], day)).status).toBe(400)
    expect((await f.request([...ids.slice(1), ids[1]], day)).status).toBe(400)
    expect((await f.request(ids, day, "organization:other")).status).toBe(403)
  },
)
