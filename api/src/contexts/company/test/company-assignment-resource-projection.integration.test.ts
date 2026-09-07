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
import * as employees from "@/contexts/company/interface/routes/company.employees"
import { DirectPersonnelActionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/direct-personnel-action.adapter"
import { EmployeeLifecycleAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle.adapter"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"

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
    .post("/employees", ...employees.POST)
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
  const personnel = async (input: PersonnelActionInput, key: string) => {
    const context = { ...base.context, env: { ...base.context.env, NOW: "2030-06-01T00:00:00Z" } }
    const revisions = await new EmployeeLifecycleAdapter(context).loadRevisions(employeeId)
    if (revisions instanceof Error) throw revisions
    return new DirectPersonnelActionAdapter(context).apply({
      session: {
        accountId: zAccountId.parse(base.creator.accountId),
        employeeId,
        hasPermission: (permission) => permission === "employee:lifecycle:apply",
      },
      employeeId,
      idempotencyKey: key,
      expectedEmployeeRevision: revisions.employeeRevision,
      expectedOrganizationRevision: revisions.organizationRevision,
      input,
    })
  }
  const assignEmployeeCode = async () => {
    const head = await base.database
      .prepare(`SELECT revision, attributes_json FROM company_resource_heads
      WHERE organization_id = 'organization:default' AND resource_type = 'employee' AND resource_id = ?1`)
      .bind(employeeId)
      .first<{ revision: number; attributes_json: string }>()
    if (head === null) throw new Error("employee resource missing")
    const attributes = z.object({ personId: z.string() }).parse(JSON.parse(head.attributes_json))
    const revision = await base.database
      .prepare("SELECT revision FROM company_organizations WHERE id = 'organization:default'")
      .first<number>("revision")
    expect(
      Number(
        (
          await client.employees.$post({
            header: {
              "idempotency-key": "employee-code",
              "if-match": String(revision),
              "x-company-organization-id": "organization:default",
            },
            json: {
              reason: "Confirm employee code",
              resources: [
                {
                  organizationId: "organization:default",
                  type: "employee",
                  id: employeeId,
                  revision: head.revision + 1,
                  state: "active",
                  effectiveFrom: "2030-01-01",
                  effectiveTo: null,
                  attributes: { ...attributes, employeeCode: "EMPLOYEE-001" },
                },
              ],
            },
          })
        ).status,
      ),
    ).toBe(201)
  }
  const companyRevision = async () => {
    const revision = await base.database
      .prepare("SELECT revision FROM company_organizations WHERE id = 'organization:default'")
      .first<number>("revision")
    if (revision === null) throw new Error("company revision missing")
    return revision
  }
  const publicAssignments = async (date: string) => {
    const snapshot = await new D1CompanyResourceRepository(base.database).findMany({
      organizationId: "organization:default",
      types: ["assignment"],
      effectiveOn: restoreCalendarDate(date),
    })
    if (!snapshot.ok) throw snapshot.cause
    return snapshot.resources
  }
  const initializeAssignment = async () => {
    expect(
      Number(
        (
          await write([
            {
              organizationId: "organization:default",
              type: "organization-unit",
              id: "unit-period:journal",
              revision: 1,
              state: "active",
              effectiveFrom: "2030-01-01",
              effectiveTo: null,
              attributes: {
                organizationUnitId: "unit:journal",
                code: "TEAM",
                officialName: "Example Team",
                kind: "TEAM",
                parentOrganizationUnitId: root.id,
              },
            },
          ])
        ).status,
      ),
    ).toBe(201)
    await assignEmployeeCode()
    const source = {
      ...assignment,
      attributes: { ...assignment.attributes, organizationUnitId: "unit:journal" },
    }
    expect(Number((await write([source], await companyRevision(), "public-start")).status)).toBe(
      201,
    )
    return source
  }
  return {
    ...base,
    assignment,
    write,
    read,
    revision,
    root,
    persisted,
    personnel,
    assignEmployeeCode,
    companyRevision,
    publicAssignments,
    initializeAssignment,
  }
}

describe("公開Assignmentと業務の所属期間", () => {
  test("主務を変えない兼務の追加も公開し、保存失敗と再送で所属を重複させない", async () => {
    const f = await fixture()
    await f.initializeAssignment()
    const code = await f.database
      .prepare(
        "SELECT code FROM company_organization_unit_period_versions WHERE organization_unit_id = ?1 LIMIT 1",
      )
      .bind(f.root.id)
      .first<string>("code")
    if (code === null) throw new Error("root code missing")
    const input = {
      kind: "concurrent_assignment_started",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-04-01"),
      departmentCode: code,
      positionTitle: "Coordinator",
      managerEmployeeCode: null,
    } satisfies PersonnelActionInput
    const before = await f.persisted()
    await f.database.exec(
      "CREATE TRIGGER reject_new_assignment_binding BEFORE INSERT ON company_assignment_period_bindings BEGIN SELECT RAISE(ABORT, 'injected assignment binding failure'); END;",
    )
    expect(await f.personnel(input, "personnel:first-concurrent")).toBeInstanceOf(Error)
    expect(await f.persisted()).toEqual(before)
    await f.database.exec("DROP TRIGGER reject_new_assignment_binding")
    expect(await f.personnel(input, "personnel:first-concurrent")).toMatchObject({
      replayed: false,
    })
    expect(
      (await f.publicAssignments("2030-03-01")).map((resource) =>
        resource.readText("assignmentType"),
      ),
    ).toEqual(["PRIMARY"])
    expect(
      (await f.publicAssignments("2030-04-01"))
        .map((resource) => resource.readText("assignmentType"))
        .sort((left, right) => (left ?? "").localeCompare(right ?? "")),
    ).toEqual(["CONCURRENT", "PRIMARY"])
    const applied = await f.persisted()
    expect(await f.personnel(input, "personnel:first-concurrent")).toMatchObject({ replayed: true })
    expect(await f.persisted()).toEqual(applied)
  })
  test("組織番号の将来変更後も、配属時と同じ組織IDで役職を変更する", async () => {
    const f = await fixture()
    await f.initializeAssignment()
    const unit = {
      organizationId: "organization:default",
      type: "organization-unit",
      revision: 1,
      state: "active",
      effectiveFrom: "2030-01-01",
      effectiveTo: null,
      attributes: {
        organizationUnitId: "unit:journal",
        code: "TEAM",
        officialName: "Example Team",
        kind: "TEAM",
        parentOrganizationUnitId: f.root.id,
      },
    } satisfies Omit<
      Extract<NonNullable<Parameters<typeof f.write>[0]>[number], { type: "organization-unit" }>,
      "id"
    >
    expect(
      Number(
        (
          await f.write(
            [
              { ...unit, id: "unit-period:journal", revision: 2, effectiveTo: "2030-07-01" },
              {
                ...unit,
                id: "unit-period:renamed",
                effectiveFrom: "2030-07-01",
                attributes: { ...unit.attributes, code: "TEAM-NEW" },
              },
            ],
            await f.companyRevision(),
            "unit:future-code",
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      await f.personnel(
        {
          kind: "position_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-08-01"),
          departmentCode: "TEAM-NEW",
          assignmentType: "primary",
          positionTitle: "Lead",
          changeType: "promotion",
        },
        "personnel:renamed-unit",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      (await f.publicAssignments("2030-08-01")).map((resource) => ({
        unit: resource.readText("organizationUnitId"),
        title: resource.readText("positionTitle"),
      })),
    ).toEqual([{ unit: "unit:journal", title: "Lead" }])
    expect(await f.read("2030-08-01")).toMatchObject({
      primaryAssignment: { organizationUnitId: "unit:journal", positionTitle: "Lead" },
    })
  })
  test("異動先の組織IDと将来予約の境界を公開履歴へ保つ", async () => {
    const f = await fixture()
    const source = await f.initializeAssignment()
    expect(
      Number(
        (
          await f.write(
            [
              {
                organizationId: "organization:default",
                type: "organization-unit",
                id: "period:other",
                revision: 1,
                state: "active",
                effectiveFrom: "2030-01-01",
                effectiveTo: null,
                attributes: {
                  organizationUnitId: "unit:other",
                  code: "OTHER",
                  officialName: "Other Team",
                  kind: "TEAM",
                  parentOrganizationUnitId: f.root.id,
                },
              },
              {
                ...source,
                revision: 2,
                effectiveFrom: "2030-07-01",
                attributes: { ...source.attributes, positionTitle: "Future" },
              },
            ],
            await f.companyRevision(),
            "future-transfer",
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      await f.personnel(
        {
          kind: "transferred",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-03-01"),
          departmentCode: "OTHER",
          positionTitle: "Temporary Lead",
          managerEmployeeCode: null,
        },
        "personnel:transfer",
      ),
    ).toMatchObject({ replayed: false })
    for (const [date, unit] of [
      ["2030-02-01", "unit:journal"],
      ["2030-04-01", "unit:other"],
      ["2030-08-01", "unit:journal"],
    ] satisfies Array<[string, string]>) {
      expect(
        (await f.publicAssignments(date)).map((resource) =>
          resource.readText("organizationUnitId"),
        ),
      ).toEqual([unit])
      expect(await f.read(date)).toMatchObject({ primaryAssignment: { organizationUnitId: unit } })
    }
  })

  test("最新の公開版が取消でも将来の所属を孤立させる雇用取消は保存しない", async () => {
    const f = await fixture()
    const source = await f.initializeAssignment()
    expect(
      Number(
        (
          await f.write(
            [{ ...source, revision: 2, effectiveFrom: "2030-07-01" }],
            await f.companyRevision(),
            "future-employment-reference",
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      await f.personnel(
        {
          kind: "position_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-03-01"),
          departmentCode: "TEAM",
          assignmentType: "primary",
          positionTitle: "Lead",
          changeType: "promotion",
        },
        "personnel:reference",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      await f.database
        .prepare(
          "SELECT count(*) FROM company_resource_heads WHERE resource_type = 'assignment' AND state = 'active'",
        )
        .first<number>("count(*)"),
    ).toBe(0)
    const employment = await f.database
      .prepare(`SELECT revision, effective_from, attributes_json FROM company_resource_heads
      WHERE resource_type = 'employment' AND resource_id = ?1`)
      .bind(source.attributes.employmentId)
      .first<{ revision: number; effective_from: string; attributes_json: string }>()
    if (employment === null) throw new Error("employment missing")
    const change = CompanyResourceChangeEntity.create({
      commandId: "orphan-employment",
      expectedRevision: await f.companyRevision(),
      actorAccountId: f.creator.accountId,
      reason: "Withdraw employment",
      recordedAt: f.at.getTime(),
      resources: [
        {
          organizationId: "organization:default",
          type: "employment",
          id: source.attributes.employmentId,
          revision: employment.revision + 1,
          state: "void",
          effectiveFrom: restoreCalendarDate(employment.effective_from),
          effectiveTo: null,
          attributes: z.record(z.string(), z.json()).parse(JSON.parse(employment.attributes_json)),
        },
      ],
    })
    if (change instanceof Error) throw change
    const before = await f.persisted()
    expect(await new D1CompanyResourceRepository(f.database).write(change)).toMatchObject({
      kind: "invalid",
    })
    expect(await f.persisted()).toEqual(before)
    expect(await f.read("2030-08-01")).toMatchObject({
      primaryAssignment: { organizationUnitId: "unit:journal" },
    })
  })

  test("会社直下の公開所属も人事発令で終了できる", async () => {
    const f = await fixture()
    await f.assignEmployeeCode()
    expect(
      Number((await f.write([f.assignment], await f.companyRevision(), "root-start")).status),
    ).toBe(201)
    const code = await f.database
      .prepare(
        "SELECT code FROM company_organization_unit_period_versions WHERE organization_unit_id = ?1 ORDER BY revision DESC LIMIT 1",
      )
      .bind(f.root.id)
      .first<string>("code")
    if (code === null) throw new Error("root code missing")
    expect(
      await f.personnel(
        {
          kind: "assignment_ended",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-04-01"),
          departmentCode: code,
          assignmentType: "primary",
        },
        "personnel:root-end",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.publicAssignments("2030-04-01")).toEqual([])
  })

  test("同じ所属への競合発令は片方だけ確定する", async () => {
    const f = await fixture()
    await f.initializeAssignment()
    const results = await Promise.all(
      ["2030-04-01", "2030-05-01"].map((date) =>
        f.personnel(
          {
            kind: "assignment_ended",
            employeeCode: "EMPLOYEE-001",
            eventOn: restoreCalendarDate(date),
            departmentCode: "TEAM",
            assignmentType: "primary",
          },
          `personnel:race:${date}`,
        ),
      ),
    )
    expect(results.filter((result) => !(result instanceof Error))).toHaveLength(1)
    expect(results.filter((result) => result instanceof Error)).toMatchObject([
      { code: "personnel_action_stale" },
    ])
    expect(
      await f.database
        .prepare(
          "SELECT count(*) FROM company_personnel_actions WHERE operation_id LIKE 'personnel:race:%'",
        )
        .first<number>("count(*)"),
    ).toBe(1)
  })

  test("将来の所属予約を保った役職変更と訂正を公開履歴へ反映する", async () => {
    const f = await fixture()
    const source = await f.initializeAssignment()
    expect(
      Number(
        (
          await f.write(
            [
              {
                ...source,
                revision: 2,
                effectiveFrom: "2030-07-01",
                attributes: { ...source.attributes, positionTitle: "Future" },
              },
            ],
            await f.companyRevision(),
            "future",
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      await f.personnel(
        {
          kind: "position_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-03-01"),
          departmentCode: "TEAM",
          assignmentType: "primary",
          positionTitle: "Lead",
          changeType: "promotion",
        },
        "personnel:planned",
      ),
    ).toMatchObject({ replayed: false })
    for (const [date, title] of [
      ["2030-02-01", "Coordinator"],
      ["2030-04-01", "Lead"],
      ["2030-08-01", "Future"],
    ] satisfies Array<[string, string]>) {
      expect(
        (await f.publicAssignments(date)).map((resource) => resource.readText("positionTitle")),
      ).toEqual([title])
      expect(await f.read(date)).toMatchObject({ primaryAssignment: { positionTitle: title } })
    }
    const actionId = await f.database
      .prepare("SELECT id FROM company_personnel_actions WHERE operation_id = 'personnel:planned'")
      .first<string>("id")
    if (actionId === null) throw new Error("personnel action missing")
    expect(
      await f.personnel(
        {
          kind: "corrected",
          correctsActionId: actionId,
          eventOn: restoreCalendarDate("2030-06-01"),
          reason: "Correct confirmed promotion date",
          replacementAction: {
            kind: "position_changed",
            employeeCode: "EMPLOYEE-001",
            eventOn: restoreCalendarDate("2030-04-01"),
            departmentCode: "TEAM",
            assignmentType: "primary",
            positionTitle: "Corrected Lead",
            changeType: "promotion",
          },
        },
        "personnel:correct-planned",
      ),
    ).toMatchObject({ replayed: false })
    for (const [date, title] of [
      ["2030-03-15", "Coordinator"],
      ["2030-05-01", "Corrected Lead"],
      ["2030-08-01", "Future"],
    ] satisfies Array<[string, string]>) {
      expect(
        (await f.publicAssignments(date)).map((resource) => resource.readText("positionTitle")),
      ).toEqual([title])
      expect(await f.read(date)).toMatchObject({ primaryAssignment: { positionTitle: title } })
    }
  })

  test("公開所属の保存失敗で発令も履歴も残さず、同じキーで再試行する", async () => {
    const f = await fixture()
    await f.initializeAssignment()
    const input: PersonnelActionInput = {
      kind: "assignment_ended",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-04-01"),
      departmentCode: "TEAM",
      assignmentType: "primary",
    }
    const before = await f.persisted()
    const beforeActions = await f.database
      .prepare("SELECT count(*) FROM company_personnel_actions")
      .first<number>("count(*)")
    await f.database
      .exec(`CREATE TRIGGER fail_assignment_binding BEFORE UPDATE ON company_assignment_resource_bindings
      BEGIN SELECT RAISE(ABORT, 'injected assignment journal failure'); END;`)
    expect(await f.personnel(input, "personnel:retry")).toBeInstanceOf(Error)
    expect(await f.persisted()).toEqual(before)
    expect(
      await f.database
        .prepare("SELECT count(*) FROM company_personnel_actions")
        .first<number>("count(*)"),
    ).toBe(beforeActions)
    expect(
      (await f.publicAssignments("2030-05-01")).map((resource) =>
        resource.readText("positionTitle"),
      ),
    ).toEqual(["Coordinator"])
    await f.database.exec("DROP TRIGGER fail_assignment_binding")
    expect(await f.personnel(input, "personnel:retry")).toMatchObject({ replayed: false })
    expect(await f.publicAssignments("2030-05-01")).toEqual([])
    const after = await f.persisted()
    expect(await f.personnel(input, "personnel:retry")).toMatchObject({ replayed: true })
    expect(await f.persisted()).toEqual(after)
  })
  test("公開所属への発令と公開APIの再更新を往復し、退職時も両方の期間を閉じる", async () => {
    const f = await fixture()
    expect(
      Number(
        (
          await f.write([
            {
              organizationId: "organization:default",
              type: "organization-unit",
              id: "unit-period:journal",
              revision: 1,
              state: "active",
              effectiveFrom: "2030-01-01",
              effectiveTo: null,
              attributes: {
                organizationUnitId: "unit:journal",
                code: "TEAM",
                officialName: "Example Team",
                kind: "TEAM",
                parentOrganizationUnitId: f.root.id,
              },
            },
          ])
        ).status,
      ),
    ).toBe(201)
    await f.assignEmployeeCode()
    expect(
      Number(
        (
          await f.write(
            [
              {
                ...f.assignment,
                attributes: { ...f.assignment.attributes, organizationUnitId: "unit:journal" },
              },
            ],
            await f.companyRevision(),
            "public-start",
          )
        ).status,
      ),
    ).toBe(201)
    const input: PersonnelActionInput = {
      kind: "position_changed",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-03-01"),
      departmentCode: "TEAM",
      assignmentType: "primary",
      positionTitle: "Lead",
      changeType: "promotion",
    }
    expect(await f.personnel(input, "personnel:position")).toMatchObject({ replayed: false })
    const after = await f.persisted()
    expect(await f.personnel(input, "personnel:position")).toMatchObject({ replayed: true })
    expect(await f.persisted()).toEqual(after)
    for (const [date, title] of [
      ["2030-02-01", "Coordinator"],
      ["2030-04-01", "Lead"],
    ]) {
      expect(
        (await f.publicAssignments(date!)).map((resource) => resource.readText("positionTitle")),
      ).toEqual([title])
      expect(await f.read(date!)).toMatchObject({ primaryAssignment: { positionTitle: title } })
    }
    const current = (await f.publicAssignments("2030-04-01"))[0]
    if (current === undefined) throw new Error("public assignment missing")
    expect(
      Number(
        (
          await f.write(
            [
              {
                ...f.assignment,
                id: current.id,
                revision: current.revision + 1,
                effectiveFrom: current.effectiveFrom,
                attributes: {
                  ...f.assignment.attributes,
                  organizationUnitId: "unit:journal",
                  positionTitle: "Revised Lead",
                },
              },
            ],
            await f.companyRevision(),
            "public-revised",
          )
        ).status,
      ),
    ).toBe(201)
    expect(await f.read("2030-04-01")).toMatchObject({
      primaryAssignment: { positionTitle: "Revised Lead" },
    })
    expect(
      await f.personnel(
        {
          kind: "retired",
          employeeCode: "EMPLOYEE-001",
          retirementOn: restoreCalendarDate("2030-06-30"),
        },
        "personnel:retire",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      (await f.publicAssignments("2030-06-30")).map((resource) =>
        resource.readText("positionTitle"),
      ),
    ).toEqual(["Revised Lead"])
    expect(await f.publicAssignments("2030-07-01")).toEqual([])
    expect(await f.read("2030-07-01")).toMatchObject({ primaryAssignment: null })
  })
  test("公開APIで作った組織へ人事発令で配属し、実際の組織IDを保つ", async () => {
    const f = await fixture()
    expect(
      Number(
        (
          await f.write([
            {
              organizationId: "organization:default",
              type: "organization-unit",
              id: "unit-period:opaque",
              revision: 1,
              state: "active",
              effectiveFrom: "2030-01-01",
              effectiveTo: null,
              attributes: {
                organizationUnitId: "unit:opaque",
                code: "TEAM",
                officialName: "Example Team",
                kind: "TEAM",
                parentOrganizationUnitId: f.root.id,
              },
            },
          ])
        ).status,
      ),
    ).toBe(201)
    await f.assignEmployeeCode()
    const employee = await f.read("2030-06-01")
    if (employee === null || employee instanceof Error || employee.employeeCode === null)
      throw new Error("employee code missing")
    expect(
      await f.personnel(
        {
          kind: "primary_assignment_started",
          employeeCode: employee.employeeCode,
          eventOn: restoreCalendarDate("2030-01-01"),
          departmentCode: "TEAM",
          positionTitle: "Coordinator",
          managerEmployeeCode: null,
        },
        "personnel:opaque",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { organizationUnitId: "unit:opaque" },
    })
    expect(
      (await f.publicAssignments("2030-06-01")).map((resource) =>
        resource.readText("organizationUnitId"),
      ),
    ).toEqual(["unit:opaque"])
  })
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
