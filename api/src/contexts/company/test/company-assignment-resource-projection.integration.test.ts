import { CompanyAssignmentResourceHistoryAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-assignment-resource-history.adapter"
import { describe, expect, test, spyOn } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"
import { z } from "zod"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import * as adoptions from "@/contexts/company/interface/routes/company.organization-resource-adoptions"
import * as changes from "@/contexts/company/interface/routes/company.organization-changes"

async function fixture() {
  const base = await createGovernanceTaskTestContext()
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    context.set(
      "companyActor",
      CompanyActorValue.restore({
        ...base.creator,
        organizationIds: ["organization:default"],
        capabilities: ["company:admin"],
      }),
    )
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
    .get("/adoptions", ...adoptions.GET)
    .post("/adoptions", ...adoptions.POST)
    .post("/changes", ...changes.POST)
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
  if (root === null) throw new Error("root missing")
  const preview = await client.adoptions.$get({ query: { organization_unit_id: root.id } })
  expect(Number(preview.status)).toBe(200)
  const body = z
    .object({ expectedRevision: z.number(), snapshotDigest: z.string(), observedOn: z.string() })
    .parse(await preview.json())
  expect(
    Number(
      (
        await client.adoptions.$post({
          header: { "idempotency-key": "assignment-root" },
          json: { ...body, organizationUnitId: root.id, reason: "Confirm organization history" },
        })
      ).status,
    ),
  ).toBe(201)
  const employeeId = base.people[0]!.employeeId
  const employment = await base.database
    .prepare("SELECT id FROM company_employments WHERE employee_id = ?")
    .bind(employeeId)
    .first<{ id: string }>()
  if (employment === null) throw new Error("employment missing")
  const revision = await base.database
    .prepare("SELECT revision FROM company_organizations WHERE id = 'organization:default'")
    .first<number>("revision")
  if (revision === null) throw new Error("revision missing")
  type Resource = Parameters<typeof client.changes.$post>[0]["json"]["resources"][number]
  const assignment: Extract<Resource, { type: "assignment" }> = {
    organizationId: "organization:default",
    type: "assignment",
    id: "assignment:public",
    revision: 1,
    state: "active",
    effectiveFrom: "2030-01-01",
    effectiveTo: null,
    attributes: {
      employeeId,
      employmentId: employment.id,
      organizationUnitId: root.id,
      assignmentType: "PRIMARY",
      positionTitle: "Coordinator",
    },
  }
  const write = (
    resources: Resource[] = [assignment],
    expectedRevision = revision,
    key = "assignment-write",
  ) =>
    client.changes.$post({
      header: {
        "idempotency-key": key,
        "if-match": String(expectedRevision),
        "x-company-organization-id": "organization:default",
      },
      json: { reason: "Confirm assignment", resources },
    })
  const read = (date: string) =>
    new CompanyEmployeeDirectoryReadAdapter({
      env: { ...base.context.env, NOW: `${date}T00:00:00Z` },
    }).findById(employeeId)
  const persisted = () =>
    base.database
      .prepare(`SELECT
    (SELECT revision FROM company_organizations WHERE id = 'organization:default') AS company_revision,
    (SELECT revision FROM company_organization_lifecycle_states WHERE id = 1) AS organization_revision,
    (SELECT count(*) FROM company_resource_revisions) AS resources,
    (SELECT count(*) FROM company_organization_assignment_period_versions) AS periods,
    (SELECT count(*) FROM company_assignment_period_bindings) AS bindings,
    (SELECT count(*) FROM company_command_receipts) AS receipts`)
      .first()
  return { ...base, assignment, write, read, revision, root, persisted }
}

describe("公開Assignmentと業務の所属期間", () => {
  test("公開APIに保存した所属が同じ基準日の従業員一覧へ届く", async () => {
    const f = await fixture()
    expect(Number((await f.write()).status)).toBe(201)
    expect(await f.read("2029-12-31")).toMatchObject({ primaryAssignment: null })
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { organizationUnitId: f.root.id, positionTitle: "Coordinator" },
    })
  })
  test("将来予約・過去訂正・空白・取消を公開履歴と同じ所属期間へ投影する", async () => {
    const f = await fixture()
    const future = {
      ...f.assignment,
      revision: 2,
      effectiveFrom: "2030-07-01",
      attributes: { ...f.assignment.attributes, positionTitle: "Future" },
    }
    const earlier = {
      ...f.assignment,
      revision: 3,
      effectiveFrom: "2030-03-01",
      effectiveTo: "2030-05-01",
      attributes: { ...f.assignment.attributes, positionTitle: "Earlier correction" },
    }
    for (const [index, resource] of [f.assignment, future, earlier].entries())
      expect(
        Number((await f.write([resource], f.revision + index, `history-${index}`)).status),
      ).toBe(201)
    for (const [date, title] of [
      ["2030-02-01", "Coordinator"],
      ["2030-04-01", "Earlier correction"],
      ["2030-06-01", null],
      ["2030-08-01", "Future"],
    ] satisfies Array<[string, string | null]>) {
      const employee = await f.read(date)
      if (employee instanceof Error) throw employee
      expect(employee?.primaryAssignment?.positionTitle ?? null).toBe(title)
    }
    const beforeReplay = await f.persisted()
    expect(Number((await f.write([earlier], f.revision + 2, "history-2")).status)).toBe(200)
    expect(await f.persisted()).toEqual(beforeReplay)
    expect(
      Number(
        (await f.write([{ ...future, revision: 4, state: "void" }], f.revision + 3, "void-future"))
          .status,
      ),
    ).toBe(201)
    expect(await f.read("2030-08-01")).toMatchObject({ primaryAssignment: null })
    expect(await f.read("2030-02-01")).toMatchObject({
      primaryAssignment: { positionTitle: "Coordinator" },
    })
  })

  test("組織の作成と配属を一つの変更で保存し、主務の重複は全体を巻き戻す", async () => {
    const f = await fixture()
    const unit = {
      organizationId: "organization:default",
      type: "organization-unit",
      id: "unit-period:team",
      revision: 1,
      state: "active",
      effectiveFrom: "2030-01-01",
      effectiveTo: null,
      attributes: {
        organizationUnitId: "unit:team",
        code: "TEAM",
        officialName: "Example Team",
        kind: "TEAM",
        parentOrganizationUnitId: f.root.id,
      },
    } satisfies NonNullable<Parameters<typeof f.write>[0]>[number]
    const assignment = {
      ...f.assignment,
      attributes: { ...f.assignment.attributes, organizationUnitId: "unit:team" },
    }
    expect(Number((await f.write([unit, assignment])).status)).toBe(201)
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { organizationUnitId: "unit:team" },
    })
    const before = await f.persisted()
    const duplicate = { ...f.assignment, id: "assignment:duplicate" }
    expect(Number((await f.write([duplicate], f.revision + 1, "duplicate")).status)).toBe(422)
    expect(await f.persisted()).toEqual(before)
  })

  test("競合した所属変更は一つだけ確定し、更新した版で再試行できる", async () => {
    const f = await fixture()
    expect(Number((await f.write()).status)).toBe(201)
    const responses = await Promise.all(
      ["First", "Second"].map((positionTitle) =>
        f.write(
          [
            {
              ...f.assignment,
              revision: 2,
              attributes: { ...f.assignment.attributes, positionTitle },
            },
          ],
          f.revision + 1,
          `race-${positionTitle}`,
        ),
      ),
    )
    expect(
      responses.map((response) => Number(response.status)).toSorted((left, right) => left - right),
    ).toEqual([201, 409])
    expect(
      Number(
        (
          await f.write(
            [
              {
                ...f.assignment,
                revision: 3,
                attributes: { ...f.assignment.attributes, positionTitle: "Retried" },
              },
            ],
            f.revision + 2,
            "retry",
          )
        ).status,
      ),
    ).toBe(201)
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { positionTitle: "Retried" },
    })
  })

  test("所属履歴の読取前に別変更が確定しても入力不正とせず競合を返す", async () => {
    const f = await fixture()
    expect(Number((await f.write()).status)).toBe(201)
    const pending = {
      ...f.assignment,
      revision: 2,
      attributes: { ...f.assignment.attributes, positionTitle: "Retried" },
    }
    const historyRead = spyOn(
      CompanyAssignmentResourceHistoryAdapter.prototype,
      "read",
    ).mockImplementationOnce(async (resource) => {
      historyRead.mockRestore()
      expect(
        Number(
          (
            await f.write(
              [
                {
                  ...pending,
                  attributes: { ...pending.attributes, positionTitle: "Winner" },
                },
              ],
              f.revision + 1,
              "winner",
            )
          ).status,
        ),
      ).toBe(201)
      return new CompanyAssignmentResourceHistoryAdapter(f.database).read(resource)
    })
    try {
      expect(Number((await f.write([pending], f.revision + 1, "pending")).status)).toBe(409)
    } finally {
      historyRead.mockRestore()
    }
    expect(await f.persisted()).toMatchObject({ company_revision: f.revision + 2 })
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { positionTitle: "Winner" },
    })
    expect(
      Number((await f.write([{ ...pending, revision: 3 }], f.revision + 2, "pending")).status),
    ).toBe(201)
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { positionTitle: "Retried" },
    })
  })

  test("履歴を読めない場合は変更を保存せず、再試行で一度だけ確定する", async () => {
    const f = await fixture()
    const before = await f.persisted()
    const unavailable = spyOn(
      CompanyAssignmentResourceHistoryAdapter.prototype,
      "read",
    ).mockResolvedValue(new Error("history unavailable"))
    try {
      expect(Number((await f.write()).status)).toBe(503)
      expect(await f.persisted()).toEqual(before)
    } finally {
      unavailable.mockRestore()
    }
    expect(Number((await f.write()).status)).toBe(201)
    const after = await f.persisted()
    expect(Number((await f.write()).status)).toBe(200)
    expect(await f.persisted()).toEqual(after)
  })

  test("期間台帳だけを更新する操作は公開所属を置き去りにできない", async () => {
    const f = await fixture()
    expect(Number((await f.write()).status)).toBe(201)
    const before = await f.persisted()
    const failure = await f.database
      .batch([
        f.database
          .prepare(`INSERT INTO company_organization_change_operations
        (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at, actor_account_id, reason)
        SELECT 'action:unmirrored', revision, 1, 0, revision + 1, 'PENDING', 0, ?1, 'Unmirrored assignment change'
        FROM company_organization_lifecycle_states WHERE id = 1`)
          .bind(f.creator.accountId),
        f.database.prepare(`INSERT INTO company_organization_assignment_period_versions
        (period_id, revision, employment_id, employee_id, organization_unit_id, assignment_type, position_title,
         manager_employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        SELECT period_id, revision + 1, employment_id, employee_id, organization_unit_id, assignment_type, 'Unmirrored',
          manager_employee_id, starts_on, ends_on, is_void, 'action:unmirrored', 0
        FROM company_organization_assignment_period_versions WHERE revision = 1`),
        f.database.prepare(
          "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = 'action:unmirrored'",
        ),
      ])
      .then(
        () => null,
        (cause: unknown) => cause,
      )
    expect(failure).toBeInstanceOf(Error)
    expect(failure).toMatchObject({
      message: expect.stringContaining("organization assignment source is stale"),
    })
    expect(await f.persisted()).toEqual(before)
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { positionTitle: "Coordinator" },
    })
  })
})
