import { expect, test } from "bun:test"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { GET } from "@/contexts/company/interface/routes/company.changes"

const pageSchema = z.object({
  data: z.array(
    z.object({ resource_id: z.string(), organization_revision: z.number(), state: z.string() }),
  ),
  next_cursor: z.string(),
  has_more: z.boolean(),
  through_revision: z.number(),
})

function fixture() {
  const database = createCompanyD1TestDatabase(`
    CREATE TABLE company_organizations(id TEXT PRIMARY KEY, revision INTEGER);
    INSERT INTO company_organizations VALUES ('company:a', 3), ('company:b', 1);
    CREATE TABLE company_resource_revisions(
      organization_id TEXT, organization_revision INTEGER, resource_type TEXT, resource_id TEXT,
      revision INTEGER, command_id TEXT, state TEXT, effective_from TEXT, effective_to TEXT, recorded_at INTEGER);
    INSERT INTO company_resource_revisions VALUES
      ('company:a', 2, 'grade', 'z', 1, 'command:two', 'active', '2040-01-01', NULL, 20),
      ('company:a', 1, 'legal-entity', 'legal:a', 1, 'command:one', 'active', '2020-01-01', NULL, 10),
      ('company:a', 2, 'grade', 'a', 1, 'command:two', 'active', '2040-01-01', NULL, 20),
      ('company:a', 2, 'position', 'p', 1, 'command:two', 'active', '2040-01-01', NULL, 20),
      ('company:a', 3, 'grade', 'a', 2, 'command:three', 'void', '2040-01-01', NULL, 30),
      ('company:b', 1, 'person', 'private:person', 1, 'command:private', 'active', '2020-01-01', NULL, 10);
  `)
  const actors: { value: CompanyActorValue | null } = {
    value: CompanyActorValue.restore({
      accountId: "account:reader",
      employeeId: null,
      organizationIds: ["company:a"],
      capabilities: ["company:read"],
    }),
  }
  const app = new Hono<CompanyHttpEnvironment>()
    .use("*", async (context, next) => {
      if (actors.value !== null) context.set("companyActor", actors.value)
      await next()
    })
    .onError((error, context) =>
      context.json({ message: error.message }, error instanceof HTTPException ? error.status : 500),
    )
    .get("/changes", ...GET)
  const request = (query: Record<string, string> = {}, organizationId = "company:a") =>
    app.request(
      `/changes?${new URLSearchParams(query).toString()}`,
      { headers: { "x-company-organization-id": organizationId } },
      { DB: database },
    )
  return { database, actors, request }
}

test("同じcommandの変更をページ境界で失わず、停止・再送・独立consumerの再構築が一致する", async () => {
  const f = fixture()
  const first = pageSchema.parse(await (await f.request({ limit: "2" })).json())
  expect(first.data.map((row) => row.resource_id)).toEqual(["legal:a", "a"])
  expect(first.has_more).toBe(true)
  const query = {
    cursor: first.next_cursor,
    through_revision: String(first.through_revision),
    limit: "2",
  }
  const second = pageSchema.parse(await (await f.request(query)).json())
  expect(second.data.map((row) => row.resource_id)).toEqual(["z", "p"])
  expect(pageSchema.parse(await (await f.request(query)).json())).toEqual(second)
  const third = pageSchema.parse(
    await (await f.request({ ...query, cursor: second.next_cursor })).json(),
  )
  expect(third.data).toEqual([{ resource_id: "a", organization_revision: 3, state: "void" }])
  expect(third.has_more).toBe(false)
  const complete = pageSchema.parse(await (await f.request()).json())
  expect([...first.data, ...second.data, ...third.data]).toEqual(complete.data)
  expect(
    pageSchema.parse(await (await f.request({ cursor: third.next_cursor })).json()).data,
  ).toEqual([])
})

test("取得中に追加された変更は固定した上限を越えず、完了cursorから次の会社版を取得する", async () => {
  const f = fixture()
  const first = pageSchema.parse(await (await f.request({ limit: "2" })).json())
  await f.database.exec(`UPDATE company_organizations SET revision = 4 WHERE id = 'company:a';
    INSERT INTO company_resource_revisions VALUES ('company:a', 4, 'responsibility', 'later', 1, 'command:later', 'active', '2010-01-01', NULL, 40);`)
  const pinned = pageSchema.parse(
    await (await f.request({ cursor: first.next_cursor, through_revision: "3" })).json(),
  )
  expect(pinned.data.map((row) => row.resource_id)).toEqual(["z", "p", "a"])
  expect(pinned.through_revision).toBe(3)
  const resumed = pageSchema.parse(await (await f.request({ cursor: pinned.next_cursor })).json())
  expect(resumed.data.map((row) => row.resource_id)).toEqual(["later"])
  expect(resumed.through_revision).toBe(4)
})

test("会社範囲・閲覧資格・認証を検査し、別会社のcursorと未来の会社版を拒否する", async () => {
  const f = fixture()
  const first = pageSchema.parse(await (await f.request()).json())
  expect((await f.request({}, "company:b")).status).toBe(403)
  expect((await f.request({ through_revision: "4" })).status).toBe(400)
  expect((await f.request({ cursor: first.next_cursor, through_revision: "2" })).status).toBe(400)
  expect((await f.request({ cursor: "broken" })).status).toBe(400)
  expect(
    (
      await f.request({
        cursor: JSON.stringify({ organizationId: "company:b", revision: 0, type: null, id: null }),
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await f.request({
        cursor: JSON.stringify({
          organizationId: "company:a",
          revision: 2,
          type: "grade",
          id: null,
        }),
      })
    ).status,
  ).toBe(400)
  f.actors.value = CompanyActorValue.restore({
    accountId: "account:limited",
    employeeId: null,
    organizationIds: ["company:a"],
    capabilities: [],
    permissions: ["master:grade:write"],
  })
  expect((await f.request()).status).toBe(403)
  f.actors.value = null
  expect((await f.request()).status).toBe(401)
})

test("保存データや取得の異常を空の完了ページとして返さない", async () => {
  const f = fixture()
  await f.database.exec(
    "UPDATE company_resource_revisions SET resource_type = 'unknown' WHERE organization_id = 'company:a'",
  )
  expect((await f.request()).status).toBe(503)
  await f.database.exec("DROP TABLE company_resource_revisions")
  expect((await f.request()).status).toBe(503)
})

test("一つの会社版にある同一資源の複数改訂もページ境界で取りこぼさない", async () => {
  const f = fixture()
  await f.database.exec(
    "INSERT INTO company_resource_revisions VALUES ('company:a', 2, 'grade', 'a', 2, 'command:two', 'void', '2040-01-01', NULL, 20)",
  )
  const first = pageSchema.parse(await (await f.request({ limit: "2" })).json())
  const second = pageSchema.parse(
    await (await f.request({ cursor: first.next_cursor, limit: "1" })).json(),
  )
  expect(second.data).toEqual([{ resource_id: "a", organization_revision: 2, state: "void" }])
  const third = pageSchema.parse(
    await (await f.request({ cursor: second.next_cursor, limit: "1" })).json(),
  )
  expect(third.data.map((row) => row.resource_id)).toEqual(["z"])
})

test("実際の人事発令と公開履歴の全改訂を再構築し、旧台帳の内部参照を要求しない", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.assignEmployeeCode()
  const retired = await f.personnel(
    {
      kind: "retired",
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
    "feed:retired",
  )
  if (retired instanceof Error) throw retired
  const actor = CompanyActorValue.restore({
    ...f.creator,
    organizationIds: ["organization:default"],
    capabilities: ["company:read"],
  })
  const app = new Hono<CompanyHttpEnvironment>()
    .use("*", async (context, next) => {
      context.set("companyActor", actor)
      await next()
    })
    .get("/changes", ...GET)
  const received: string[] = []
  const query = new URLSearchParams({ limit: "2" })
  for (const iteration of Array.from({ length: 100 }, (_, index) => index)) {
    const response = await app.request(
      `/changes?${query.toString()}`,
      { headers: { "x-company-organization-id": "organization:default" } },
      f.context.env,
    )
    expect(response.status).toBe(200)
    const page = z
      .object({
        data: z.array(
          z.object({
            organization_revision: z.number(),
            resource_type: z.string(),
            resource_id: z.string(),
            revision: z.number(),
          }),
        ),
        has_more: z.boolean(),
        next_cursor: z.string(),
        through_revision: z.number(),
      })
      .parse(await response.json())
    received.push(
      ...page.data.map((row) =>
        JSON.stringify([
          row.organization_revision,
          row.resource_type,
          row.resource_id,
          row.revision,
        ]),
      ),
    )
    if (!page.has_more) break
    if (iteration === 99) throw new Error("change feed failed to finish")
    query.set("cursor", page.next_cursor)
    query.set("through_revision", String(page.through_revision))
  }
  const expected = await f.database
    .prepare(
      "SELECT organization_revision, resource_type, resource_id, revision FROM company_resource_revisions WHERE organization_id = 'organization:default' ORDER BY organization_revision, resource_type, resource_id, revision",
    )
    .all<{
      organization_revision: number
      resource_type: string
      resource_id: string
      revision: number
    }>()
  expect(received).toEqual(
    expected.results.map((row) =>
      JSON.stringify([row.organization_revision, row.resource_type, row.resource_id, row.revision]),
    ),
  )
  expect(received.length).toBeGreaterThan(2)
  expect(new Set(received).size).toBe(received.length)
})
