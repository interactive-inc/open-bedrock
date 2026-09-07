import { describe, expect, test, spyOn } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"
import { z } from "zod"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import * as organizationChanges from "@/contexts/company/interface/routes/company.organization-changes"
import * as organizationAdoptions from "@/contexts/company/interface/routes/company.organization-resource-adoptions"
import * as organizationSnapshots from "@/contexts/company/interface/routes/company.organization-snapshots"

const relationSchema = z.object({
  organizationId: z.string(),
  type: z.literal("reporting-relation"),
  id: z.string(),
  revision: z.number(),
  state: z.enum(["active", "void"]),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  attributes: z.object({
    employeeId: z.string(),
    managerEmployeeId: z.string(),
    organizationUnitId: z.string(),
  }),
})
type Relation = z.infer<typeof relationSchema>

async function fixture() {
  const base = await createGovernanceTaskTestContext()
  const actor = CompanyActorValue.restore({
    accountId: base.creator.accountId,
    employeeId: base.creator.employeeId,
    organizationIds: ["organization:default"],
    capabilities: ["company:admin"],
  })
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    context.set("companyActor", actor)
    context.set("companyClock", () => base.at)
    context.set("database", base.context.var.database)
    context.set("auditContext", base.context.var.auditContext)
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  const routes = app
    .get("/organization-resource-adoptions", ...organizationAdoptions.GET)
    .post("/organization-resource-adoptions", ...organizationAdoptions.POST)
    .post("/organization-changes", ...organizationChanges.POST)
    .get("/organization-snapshots", ...organizationSnapshots.GET)
  const client = hc<typeof routes>("http://localhost", {
    fetch: Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        routes.request(input, init, base.context.env),
      { preconnect: fetch.preconnect },
    ),
  })
  const root = await base.database
    .prepare(
      "SELECT organization_unit_id AS id FROM company_organization_unit_period_versions WHERE kind = 'COMPANY' LIMIT 1",
    )
    .first<{ id: string }>()
  if (root === null) throw new Error("organization root missing")
  const previewResponse = await client["organization-resource-adoptions"].$get({
    query: { organization_unit_id: root.id },
  })
  expect(Number(previewResponse.status)).toBe(200)
  const preview = z
    .object({ expectedRevision: z.number(), snapshotDigest: z.string(), observedOn: z.string() })
    .parse(await previewResponse.json())
  const connected = await client["organization-resource-adoptions"].$post({
    header: { "idempotency-key": "connect-root" },
    json: { ...preview, organizationUnitId: root.id, reason: "Confirm organization history" },
  })
  expect(Number(connected.status)).toBe(201)
  const revision = await base.database
    .prepare("SELECT revision FROM company_organizations WHERE id = 'organization:default'")
    .first<number>("revision")
  if (revision === null) throw new Error("organization revision missing")
  const write = (resources: Relation[], key: string, expectedRevision = revision) =>
    client["organization-changes"].$post({
      header: {
        "x-company-organization-id": "organization:default",
        "if-match": String(expectedRevision),
        "idempotency-key": key,
      },
      json: { reason: "Confirm reporting lines", resources },
    })
  const employee = (index: number) => {
    const person = base.people[index]
    if (person === undefined) throw new Error("employee fixture missing")
    return person.employeeId
  }
  const relation = (id: string, employeeIndex: number, managerIndex: number): Relation => ({
    organizationId: "organization:default",
    type: "reporting-relation",
    id,
    revision: 1,
    state: "active",
    effectiveFrom: "2030-01-01",
    effectiveTo: null,
    attributes: {
      employeeId: employee(employeeIndex),
      managerEmployeeId: employee(managerIndex),
      organizationUnitId: root.id,
    },
  })
  const persisted = () =>
    base.database
      .prepare(`SELECT
        (SELECT revision FROM company_organizations WHERE id = 'organization:default') AS revision,
        (SELECT COUNT(*) FROM company_resource_revisions) AS resources,
        (SELECT COUNT(*) FROM company_command_receipts) AS receipts`)
      .first<{ revision: number; resources: number; receipts: number }>()
  const readRelations = async (date: string) => {
    const response = await client["organization-snapshots"].$get({
      header: { "x-company-organization-id": "organization:default" },
      query: { as_of: date },
    })
    expect(Number(response.status)).toBe(200)
    const snapshot = z
      .object({ resources: z.array(z.object({ type: z.string() }).passthrough()) })
      .parse(await response.json())
    return snapshot.resources
      .filter((resource) => resource.type === "reporting-relation")
      .map((resource) => relationSchema.parse(resource))
  }
  return { write, relation, persisted, revision, readRelations, database: base.database }
}

describe("Company reporting graph through organization changes", () => {
  test("rejects a cycle hidden by another manager in every input order without saving", async () => {
    const f = await fixture()
    const ab = f.relation("report:ab", 0, 1)
    const ba = f.relation("report:ba", 1, 0)
    const ac = f.relation("report:ac", 0, 2)
    const before = await f.persisted()
    for (const resources of [
      [ab, ba, ac],
      [ab, ac, ba],
      [ba, ab, ac],
      [ba, ac, ab],
      [ac, ab, ba],
      [ac, ba, ab],
    ]) {
      const response = await f.write(resources, `cycle:${resources.map((r) => r.id).join("-")}`)
      expect(Number(response.status)).toBe(422)
      expect(z.object({ code: z.string() }).parse(await response.json()).code).toBe(
        "invalid_organization",
      )
      expect(await f.persisted()).toEqual(before)
    }
  })

  test("accepts multiple managers and a diamond, replays once, and rejects a cyclic update", async () => {
    const f = await fixture()
    const bd = f.relation("report:bd", 1, 3)
    const resources = [
      f.relation("report:ab", 0, 1),
      f.relation("report:ac", 0, 2),
      bd,
      f.relation("report:cd", 2, 3),
    ]
    expect(Number((await f.write(resources, "diamond")).status)).toBe(201)
    const before = await f.persisted()
    expect(Number((await f.write(resources, "diamond")).status)).toBe(200)
    expect(await f.persisted()).toEqual(before)
    const cycle = { ...f.relation(bd.id, 1, 0), revision: 2 }
    expect(Number((await f.write([cycle], "cyclic-update", f.revision + 1)).status)).toBe(422)
    expect(await f.persisted()).toEqual(before)
  })

  test("allows touching periods but rejects a cycle that starts with a future overlap", async () => {
    const f = await fixture()
    const ab = { ...f.relation("report:ab", 0, 1), effectiveTo: "2030-02-01" }
    const ba = { ...f.relation("report:ba", 1, 0), effectiveFrom: "2030-02-01" }
    const ac = f.relation("report:ac", 0, 2)
    expect(Number((await f.write([ab, ba, ac], "touching")).status)).toBe(201)
    const before = await f.persisted()
    const overlap = { ...ba, revision: 2, effectiveFrom: "2030-01-31" }
    expect(Number((await f.write([overlap], "overlap", f.revision + 1)).status)).toBe(422)
    expect(await f.persisted()).toEqual(before)
  })

  const futureStates: ReadonlyArray<Relation["state"]> = ["active", "void"]
  test.each([...futureStates])(
    "retains earlier reporting periods when a future version is %s",
    async (state) => {
      const f = await fixture()
      const ab = f.relation("report:ab", 0, 1)
      expect(Number((await f.write([ab], "initial")).status)).toBe(201)
      const future = {
        ...f.relation(ab.id, 0, 2),
        revision: 2,
        state,
        effectiveFrom: "2030-03-01",
      }
      expect(Number((await f.write([future], "future", f.revision + 1)).status)).toBe(201)
      expect(await f.readRelations("2030-01-15")).toEqual([ab])
      expect(await f.readRelations("2030-03-01")).toEqual(state === "active" ? [future] : [])
      const before = await f.persisted()
      const reverse = { ...f.relation("report:ba", 1, 0), effectiveTo: "2030-02-01" }
      const response = await f.write([reverse], "earlier-cycle", f.revision + 2)
      expect(Number(response.status)).toBe(422)
      expect(await f.persisted()).toEqual(before)
      expect(await f.readRelations("2030-01-15")).toEqual([ab])
    },
  )

  test("keeps a scheduled future manager when correcting an earlier period", async () => {
    const f = await fixture()
    const ab = f.relation("report:ab", 0, 1)
    expect(Number((await f.write([ab], "initial")).status)).toBe(201)
    const future = { ...ab, revision: 2, effectiveFrom: "2030-03-01" }
    expect(Number((await f.write([future], "future", f.revision + 1)).status)).toBe(201)
    const correction = { ...f.relation(ab.id, 0, 2), revision: 3 }
    expect(Number((await f.write([correction], "correction", f.revision + 2)).status)).toBe(201)
    const reverse = { ...f.relation("report:ba", 1, 0), effectiveTo: "2030-03-01" }
    expect(Number((await f.write([reverse], "earlier-reverse", f.revision + 3)).status)).toBe(201)
    expect(await f.readRelations("2030-02-01")).toEqual([correction, reverse])
    expect(await f.readRelations("2030-03-01")).toEqual([future])
    const before = await f.persisted()
    const laterReverse = { ...reverse, revision: 2, effectiveTo: null }
    expect(Number((await f.write([laterReverse], "later-cycle", f.revision + 4)).status)).toBe(422)
    expect(await f.persisted()).toEqual(before)
  })

  test("rejects the losing concurrent write and refuses its cyclic retry", async () => {
    const f = await fixture()
    const resources = [f.relation("report:ab", 0, 1), f.relation("report:ba", 1, 0)]
    const responses = await Promise.all(
      resources.map((resource) => f.write([resource], resource.id)),
    )
    expect(responses.map((response) => Number(response.status)).toSorted()).toEqual([201, 409])
    const loser = resources[responses.findIndex((response) => Number(response.status) === 409)]
    if (loser === undefined) throw new Error("concurrent loser missing")
    const before = await f.persisted()
    expect(Number((await f.write([loser], "retry-cycle", f.revision + 1)).status)).toBe(422)
    expect(await f.persisted()).toEqual(before)
    expect(await f.readRelations("2030-01-15")).toHaveLength(1)
  })

  test("accepts an acyclic future even when the newest revision describes an earlier manager", async () => {
    const f = await fixture()
    const ab = f.relation("report:ab", 0, 1)
    expect(Number((await f.write([ab], "initial")).status)).toBe(201)
    const future = { ...f.relation(ab.id, 0, 2), revision: 2, effectiveFrom: "2030-03-01" }
    expect(Number((await f.write([future], "future", f.revision + 1)).status)).toBe(201)
    const correction = { ...ab, revision: 3 }
    expect(Number((await f.write([correction], "correction", f.revision + 2)).status)).toBe(201)
    const reverse = { ...f.relation("report:ba", 1, 0), effectiveFrom: "2030-03-01" }
    expect(Number((await f.write([reverse], "later-reverse", f.revision + 3)).status)).toBe(201)
    expect(await f.readRelations("2030-02-01")).toEqual([correction])
    expect(await f.readRelations("2030-03-01")).toEqual([future, reverse])
  })

  test("does not treat an unavailable history as empty and can retry without a partial write", async () => {
    const f = await fixture()
    const before = await f.persisted()
    const prepare = f.database.prepare.bind(f.database)
    const failure = spyOn(f.database, "prepare").mockImplementation((sql) => {
      if (
        sql.includes("resource_type = 'reporting-relation'") &&
        sql.includes("organization_revision <= ?")
      )
        throw new Error("Reporting history unavailable")
      return prepare(sql)
    })
    const resource = f.relation("report:ab", 0, 1)
    try {
      expect(Number((await f.write([resource], "history-retry")).status)).toBe(503)
    } finally {
      failure.mockRestore()
    }
    expect(await f.persisted()).toEqual(before)
    expect(Number((await f.write([resource], "history-retry")).status)).toBe(201)
    expect(await f.readRelations("2030-01-15")).toEqual([resource])
  })
})
