import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { Hono } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { DirectPersonnelActionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/direct-personnel-action.adapter"
import { PersonnelActionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { ResolveLiveEmployeeAccessAdapter } from "@/contexts/company/infrastructure/adapters/employee/resolve-live-employee-access.adapter"
import { POST as POST_PEOPLE } from "@/contexts/company/interface/routes/company.people"
import { POST as POST_EMPLOYEES } from "@/contexts/company/interface/routes/company.employees"
import {
  GET as GET_EMPLOYMENTS,
  POST as POST_EMPLOYMENTS,
} from "@/contexts/company/interface/routes/company.employments"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
const employeeId = restoreWorkforceId("employee", "employee:resource")
const organizationId = "organization:default"
const actor = CompanyActorValue.restore({
  accountId: "account:operator",
  employeeId: "employee:operator",
  organizationIds: [organizationId],
  capabilities: ["company:read", "company:write"],
})
type Resource = {
  organizationId: string
  type: "person" | "employee" | "employment"
  id: string
  revision: number
  state: "active" | "void"
  effectiveFrom: string
  effectiveTo: string | null
  attributes: Record<string, string | null>
}
const person: Resource = {
  organizationId,
  type: "person",
  id: "person:resource",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  attributes: { officialName: "Example Person", email: "you@example.com" },
}
const employee: Resource = {
  ...person,
  type: "employee",
  id: employeeId,
  attributes: { personId: person.id, employeeCode: "RESOURCE-001" },
}
const employment: Resource = {
  ...person,
  type: "employment",
  id: "employment:resource",
  attributes: { employeeId, status: "ACTIVE", employmentType: "FULL_TIME" },
}

function fixture() {
  const database = createCompanyD1TestDatabase(schemaSql)
  const app = new Hono<{
    Bindings: { DB: D1Database }
    Variables: { companyActor: CompanyActorValue }
  }>()
  app.use("*", async (c, next) => {
    c.set("companyActor", actor)
    await next()
  })
  app.onError((error, c) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return c.json({ code: error.code }, error.status)
  })
  app
    .post("/company/people", ...POST_PEOPLE)
    .post("/company/employees", ...POST_EMPLOYEES)
    .post("/company/employments", ...POST_EMPLOYMENTS)
    .get("/company/employments", ...GET_EMPLOYMENTS)
  const write = (
    resource: Resource,
    expectedRevision: number,
    key = `command:${expectedRevision}`,
  ) =>
    app.request(
      `/company/${resource.type === "person" ? "people" : resource.type === "employee" ? "employees" : "employments"}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-company-organization-id": organizationId,
          "idempotency-key": key,
          "if-match": `"${expectedRevision}"`,
        },
        body: JSON.stringify({ reason: "Record confirmed workforce facts", resources: [resource] }),
      },
      { DB: database },
    )
  const context = (now: string) => ({
    env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo", NOW: now },
  })
  const lifecycleContext: CompanyContext = {
    env: context("2026-12-01T00:00:00Z").env,
    var: {
      database: drizzle(database),
      auditContext: {
        requestId: "00000000-0000-4000-8000-000000000001",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      },
    },
  }
  return {
    database,
    write,
    directory: (now: string) =>
      new CompanyEmployeeDirectoryReadAdapter(context(now)).findById(employeeId),
    access: (now: string) =>
      new ResolveLiveEmployeeAccessAdapter(context(now)).resolveLiveEmployeeAccess(employeeId),
    readEmployment: (date: string) =>
      app.request(
        `/company/employments?as_of=${date}`,
        {
          headers: { "x-company-organization-id": organizationId },
        },
        { DB: database },
      ),
    listPersonnelActions: () =>
      new PersonnelActionAdapter(lifecycleContext).listForEmployee({
        employeeId,
        from: null,
        to: null,
        anchorRowId: Number.MAX_SAFE_INTEGER,
        position: null,
        limit: 100,
      }),
    applyPersonnelAction: async (input: PersonnelActionInput, key: string) => {
      const employeeRevision = await database
        .prepare("SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = ?1")
        .bind(employeeId)
        .first<number>("revision")
      const organizationRevision = await database
        .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
        .first<number>("revision")
      if (employeeRevision === null || organizationRevision === null)
        throw new Error("missing lifecycle revision")
      return new DirectPersonnelActionAdapter(lifecycleContext).apply({
        session: {
          accountId: zAccountId.parse(actor.accountId),
          employeeId: restoreWorkforceId("employee", "employee:operator"),
          hasPermission: (permission) => permission === "employee:lifecycle:apply",
        },
        employeeId,
        idempotencyKey: key,
        expectedEmployeeRevision: employeeRevision,
        expectedOrganizationRevision: organizationRevision,
        input,
      })
    },
    initialize: async () => {
      expect((await write(person, 0)).status).toBe(201)
      expect((await write(employee, 1)).status).toBe(201)
      expect((await write(employment, 2)).status).toBe(201)
    },
  }
}

describe("公開Company APIから実際の従業員台帳と在籍判定まで", () => {
  test("公開APIで作った雇用への人事発令が公開履歴へ戻り、次の公開writeも続けられる", async () => {
    const f = fixture()
    await f.initialize()
    const leave: PersonnelActionInput = {
      kind: "leave_started",
      employeeCode: "RESOURCE-001",
      eventOn: restoreCalendarDate("2027-01-01"),
    }
    expect(await f.applyPersonnelAction(leave, "journal:leave")).toMatchObject({ replayed: false })
    expect(await (await f.readEmployment("2026-12-31")).json()).toMatchObject({
      resources: [{ attributes: { status: "ACTIVE", employmentType: "FULL_TIME" } }],
    })
    expect(await (await f.readEmployment("2027-01-01")).json()).toMatchObject({
      resources: [{ attributes: { status: "ON_LEAVE" } }],
    })
    const rowsBefore = await f.database
      .prepare("SELECT count(*) AS total FROM company_resource_revisions")
      .first<number>("total")
    expect(await f.applyPersonnelAction(leave, "journal:leave")).toMatchObject({ replayed: true })
    expect(
      await f.database
        .prepare("SELECT count(*) AS total FROM company_resource_revisions")
        .first<number>("total"),
    ).toBe(rowsBefore)
    const resourceRevision = await f.database
      .prepare("SELECT revision FROM company_resource_heads WHERE resource_id = ?1")
      .bind(employment.id)
      .first<number>("revision")
    const organizationRevision = await f.database
      .prepare("SELECT revision FROM company_organizations WHERE id = ?1")
      .bind(organizationId)
      .first<number>("revision")
    if (resourceRevision === null || organizationRevision === null)
      throw new Error("missing public revision")
    expect(
      (
        await f.write(
          { ...employment, revision: resourceRevision + 1, effectiveFrom: "2027-02-01" },
          organizationRevision,
        )
      ).status,
    ).toBe(201)
    expect(await f.access("2027-01-15T00:00:00Z")).toMatchObject({ status: "ON_LEAVE" })
    expect(await f.access("2027-02-15T00:00:00Z")).toMatchObject({ status: "ACTIVE" })
    const actions = await f.listPersonnelActions()
    expect(actions).not.toBeInstanceOf(Error)
    if (actions instanceof Error) throw actions
    expect(actions.map((action) => action.kind).sort()).toEqual([
      "employment_revised",
      "employment_revised",
      "leave_started",
    ])
    expect(actions.every((action) => !action.corrected)).toBe(true)
  })

  test("休職日の訂正・復職・退職・再入社も公開履歴と同じ日付で解決する", async () => {
    const f = fixture()
    await f.initialize()
    expect(
      await f.applyPersonnelAction(
        {
          kind: "leave_started",
          employeeCode: "RESOURCE-001",
          eventOn: restoreCalendarDate("2027-01-01"),
        },
        "journal:corrected-leave",
      ),
    ).toMatchObject({ replayed: false })
    const actionId = await f.database
      .prepare(
        "SELECT id FROM company_personnel_actions WHERE operation_id = 'journal:corrected-leave'",
      )
      .first<string>("id")
    if (actionId === null) throw new Error("missing leave action")
    expect(
      await f.applyPersonnelAction(
        {
          kind: "corrected",
          eventOn: restoreCalendarDate("2026-12-01"),
          correctsActionId: actionId,
          reason: "Correct the confirmed leave start",
          replacementAction: {
            kind: "leave_started",
            employeeCode: "RESOURCE-001",
            eventOn: restoreCalendarDate("2027-01-15"),
          },
        },
        "journal:correct-leave",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      await f.applyPersonnelAction(
        {
          kind: "returned",
          employeeCode: "RESOURCE-001",
          eventOn: restoreCalendarDate("2027-02-01"),
        },
        "journal:return",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      await f.applyPersonnelAction(
        {
          kind: "retired",
          employeeCode: "RESOURCE-001",
          retirementOn: restoreCalendarDate("2027-03-31"),
        },
        "journal:retire",
      ),
    ).toMatchObject({ replayed: false })
    for (const scenario of [
      { date: "2027-01-01", status: "ACTIVE" },
      { date: "2027-01-15", status: "ON_LEAVE" },
      { date: "2027-02-01", status: "ACTIVE" },
      { date: "2027-04-01", status: "TERMINATED" },
    ])
      expect(await (await f.readEmployment(scenario.date)).json()).toMatchObject({
        resources: [{ attributes: { status: scenario.status } }],
      })
    expect(
      await f.applyPersonnelAction(
        {
          kind: "rehire",
          employeeCode: "RESOURCE-001",
          eventOn: restoreCalendarDate("2027-06-01"),
        },
        "journal:rehire",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.access("2027-05-15T00:00:00Z")).toBeNull()
    expect(await f.access("2027-06-01T00:00:00Z")).toMatchObject({ status: "ACTIVE" })
    const current = await f.readEmployment("2027-06-01")
    expect(current.status).toBe(200)
    expect(await current.json()).toMatchObject({
      resources: expect.arrayContaining([
        expect.objectContaining({ attributes: expect.objectContaining({ status: "ACTIVE" }) }),
      ]),
    })
    expect(await f.listPersonnelActions()).not.toBeInstanceOf(Error)
  })

  test("人事発令の公開履歴保存が失敗したら、期間・発令・監査も確定しない", async () => {
    const f = fixture()
    await f.initialize()
    const tables = [
      "company_personnel_actions",
      "company_employee_status_period_versions",
      "company_resource_revisions",
      "company_command_receipts",
      "system_audit_events",
    ]
    const counts = async () =>
      Promise.all(
        tables.map((table) =>
          f.database.prepare(`SELECT count(*) AS total FROM ${table}`).first<number>("total"),
        ),
      )
    const before = await counts()
    await f.database.exec(
      "CREATE TRIGGER reject_lifecycle_journal BEFORE INSERT ON company_resource_revisions WHEN NEW.command_id LIKE 'lifecycle:%' BEGIN SELECT RAISE(ABORT, 'injected journal failure'); END;",
    )
    const leave: PersonnelActionInput = {
      kind: "leave_started",
      employeeCode: "RESOURCE-001",
      eventOn: restoreCalendarDate("2027-01-01"),
    }
    expect(await f.applyPersonnelAction(leave, "journal:rollback")).toBeInstanceOf(Error)
    expect(await counts()).toEqual(before)
    expect(await f.access("2027-01-15T00:00:00Z")).toMatchObject({ status: "ACTIVE" })
    await f.database.exec("DROP TRIGGER reject_lifecycle_journal")
    expect(await f.applyPersonnelAction(leave, "journal:rollback")).toMatchObject({
      replayed: false,
    })
  })

  test("公開writeと既存人事発令が競合したら一方だけを確定する", async () => {
    const f = fixture()
    await f.initialize()
    const [action, response] = await Promise.all([
      f.applyPersonnelAction(
        {
          kind: "leave_started",
          employeeCode: "RESOURCE-001",
          eventOn: restoreCalendarDate("2027-01-01"),
        },
        "journal:race",
      ),
      f.write({ ...employment, revision: 2, effectiveTo: "2027-01-01" }, 3),
    ])
    if (action instanceof Error) {
      expect(action).toMatchObject({ code: "personnel_action_stale" })
      expect(response.status).toBe(201)
      expect(await f.access("2027-01-15T00:00:00Z")).toBeNull()
    } else {
      expect(action).toMatchObject({ replayed: false })
      expect(response.status).toBe(409)
      expect(await f.access("2027-01-15T00:00:00Z")).toMatchObject({ status: "ON_LEAVE" })
    }
  })

  test("登録した氏名・従業員番号・雇用が名簿と利用資格へ届き、再送で発令を増やさない", async () => {
    const f = fixture()
    await f.initialize()
    expect(await f.directory("2026-06-01T00:00:00Z")).toMatchObject({
      id: employeeId,
      officialName: "Example Person",
      employeeCode: "RESOURCE-001",
      email: "you@example.com",
      employment: { id: employment.id, status: "ACTIVE" },
    })
    expect(await f.directory("2025-12-31T14:59:59Z")).toBeNull()
    expect(await f.access("2025-12-31T15:00:00Z")).toMatchObject({ status: "ACTIVE" })
    expect((await f.write(employment, 2)).status).toBe(200)
    expect(
      await f.database
        .prepare("SELECT count(*) AS total FROM company_personnel_actions WHERE employee_id = ?1")
        .bind(employeeId)
        .first<number>("total"),
    ).toBe(1)
    expect(
      await f.database
        .prepare(
          "SELECT recorded_by_account_id, source_type FROM company_personnel_actions WHERE employee_id = ?1",
        )
        .bind(employeeId)
        .first<{ recorded_by_account_id: string; source_type: string }>(),
    ).toEqual({ recorded_by_account_id: actor.accountId, source_type: "system" })
  })

  test("未来の休職・復職・退職を先に登録しても、当日の在籍判定を前倒ししない", async () => {
    const f = fixture()
    await f.initialize()
    expect(
      (
        await f.write(
          {
            ...employment,
            revision: 2,
            effectiveFrom: "2026-07-01",
            attributes: { ...employment.attributes, status: "ON_LEAVE" },
          },
          3,
        )
      ).status,
    ).toBe(201)
    expect(
      (await f.write({ ...employment, revision: 3, effectiveFrom: "2026-09-01" }, 4)).status,
    ).toBe(201)
    expect(
      (
        await f.write(
          {
            ...employment,
            revision: 4,
            effectiveFrom: "2026-10-01",
            attributes: { ...employment.attributes, status: "TERMINATED" },
          },
          5,
        )
      ).status,
    ).toBe(201)
    for (const scenario of [
      { now: "2026-06-30T14:59:59Z", status: "ACTIVE" },
      { now: "2026-06-30T15:00:00Z", status: "ON_LEAVE" },
      { now: "2026-08-31T15:00:00Z", status: "ACTIVE" },
      { now: "2026-09-30T14:59:59Z", status: "ACTIVE" },
    ]) {
      expect(await f.directory(scenario.now)).toMatchObject({
        employment: { status: scenario.status },
      })
      expect(await f.access(scenario.now)).toMatchObject({ status: scenario.status })
    }
    expect(await f.directory("2026-09-30T15:00:00Z")).toMatchObject({
      employment: { status: "TERMINATED" },
    })
    expect(await f.access("2026-09-30T15:00:00Z")).toBeNull()
  })

  test("同じ発効日の訂正と取消を読み、古い状態を復活させない", async () => {
    const f = fixture()
    await f.initialize()
    expect(
      (await f.write({ ...employment, revision: 2, effectiveTo: "2026-10-01" }, 3)).status,
    ).toBe(201)
    expect(
      (await f.write({ ...employment, revision: 3, effectiveTo: "2026-11-01" }, 4)).status,
    ).toBe(201)
    expect(await f.access("2026-10-15T00:00:00Z")).toMatchObject({ status: "ACTIVE" })
    expect((await f.write({ ...employment, revision: 4, state: "void" }, 5)).status).toBe(201)
    expect(await f.access("2026-06-01T00:00:00Z")).toBeNull()
    expect(await f.directory("2026-06-01T00:00:00Z")).toMatchObject({ employment: null })
    expect((await f.write({ ...employee, revision: 2, state: "void" }, 6)).status).toBe(201)
    expect(await f.directory("2026-06-01T00:00:00Z")).toBeNull()
  })

  test("将来の氏名変更と従業員番号は発効日前後で切り替わる", async () => {
    const f = fixture()
    await f.initialize()
    expect(
      (
        await f.write(
          {
            ...person,
            revision: 2,
            effectiveFrom: "2026-10-01",
            attributes: { officialName: "Example Updated" },
          },
          3,
        )
      ).status,
    ).toBe(201)
    expect(
      (
        await f.write(
          {
            ...employee,
            revision: 2,
            effectiveFrom: "2026-10-01",
            attributes: { ...employee.attributes, employeeCode: "RESOURCE-002" },
          },
          4,
        )
      ).status,
    ).toBe(201)
    expect(await f.directory("2026-09-30T14:59:59Z")).toMatchObject({
      officialName: "Example Person",
      employeeCode: "RESOURCE-001",
    })
    expect(await f.directory("2026-09-30T15:00:00Z")).toMatchObject({
      officialName: "Example Updated",
      employeeCode: "RESOURCE-002",
    })
  })

  test("期間保存が失敗したら公開履歴・receipt・業務台帳のすべてを戻し、同じkeyで再試行できる", async () => {
    const f = fixture()
    expect((await f.write(person, 0)).status).toBe(201)
    expect((await f.write(employee, 1)).status).toBe(201)
    await f.database.exec(
      "CREATE TRIGGER reject_resource_status BEFORE INSERT ON company_employee_status_period_versions BEGIN SELECT RAISE(ABORT, 'injected storage failure'); END;",
    )
    expect((await f.write(employment, 2)).status).toBe(503)
    for (const query of [
      "SELECT resource_id FROM company_resource_heads WHERE resource_type = 'employment'",
      "SELECT resource_id FROM company_resource_revisions WHERE resource_type = 'employment'",
      "SELECT id FROM company_employments",
      "SELECT id FROM company_personnel_actions",
      "SELECT employee_id FROM company_employee_lifecycle_revisions",
      "SELECT command_id FROM company_command_receipts WHERE command_id = 'command:2'",
    ])
      expect(await f.database.prepare(query).first()).toBeNull()
    expect(
      await f.database
        .prepare("SELECT revision FROM company_organizations WHERE id = ?1")
        .bind(organizationId)
        .first<number>("revision"),
    ).toBe(2)
    await f.database.exec("DROP TRIGGER reject_resource_status")
    expect((await f.write(employment, 2)).status).toBe(201)
  })

  test("既存の別経路の人事変更を公開resourceの更新で上書きしない", async () => {
    const f = fixture()
    await f.initialize()
    await f.database
      .prepare(
        "UPDATE company_employee_lifecycle_revisions SET revision = revision + 1 WHERE employee_id = ?1",
      )
      .bind(employeeId)
      .run()
    expect(
      (await f.write({ ...employment, revision: 2, effectiveTo: "2026-10-01" }, 3)).status,
    ).toBe(422)
    expect(
      await f.database
        .prepare("SELECT revision FROM company_resource_heads WHERE resource_id = ?1")
        .bind(employment.id)
        .first<number>("revision"),
    ).toBe(1)
    expect(await f.access("2026-10-15T00:00:00Z")).toMatchObject({ status: "ACTIVE" })
  })

  test("重なる雇用と未対応の雇用区分を拒否し、同じEmployeeの台帳を壊さない", async () => {
    const f = fixture()
    await f.initialize()
    expect((await f.write({ ...employment, id: "employment:overlap" }, 3)).status).toBe(422)
    expect(
      (
        await f.write(
          { ...employment, revision: 2, attributes: { employeeId, status: "ACTIVE" } },
          3,
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await f.write(
          {
            ...employment,
            revision: 2,
            attributes: { ...employment.attributes, employmentType: "UNKNOWN" },
          },
          3,
        )
      ).status,
    ).toBe(400)
    expect(await f.access("2026-06-01T00:00:00Z")).toMatchObject({ status: "ACTIVE" })
  })

  test("再入社は別の雇用として受け取り、退職から再入社までの空白を在籍扱いしない", async () => {
    const f = fixture()
    await f.initialize()
    expect(
      (await f.write({ ...employment, revision: 2, effectiveTo: "2026-04-01" }, 3)).status,
    ).toBe(201)
    expect(
      (await f.write({ ...employment, id: "employment:rehire", effectiveFrom: "2026-05-01" }, 4))
        .status,
    ).toBe(201)
    expect(await f.access("2026-04-15T00:00:00Z")).toBeNull()
    expect(await f.directory("2026-04-15T00:00:00Z")).toMatchObject({
      employment: { id: employment.id, status: "TERMINATED" },
    })
    expect(await f.directory("2026-05-01T00:00:00Z")).toMatchObject({
      employment: { id: "employment:rehire", status: "ACTIVE" },
    })
    const overlapping = {
      ...employment,
      id: "employment:closed-overlap",
      effectiveFrom: "2026-03-01",
      effectiveTo: "2026-03-15",
    }
    expect((await f.write(overlapping, 5)).status).toBe(422)
    expect(
      await f.database
        .prepare("SELECT id FROM company_employments WHERE id = ?1")
        .bind(overlapping.id)
        .first(),
    ).toBeNull()
  })

  test("PersonとEmployeeの有効期間に空白がある場合は雇用期間を作らない", async () => {
    const f = fixture()
    expect((await f.write({ ...person, effectiveTo: "2026-03-01" }, 0)).status).toBe(201)
    expect((await f.write({ ...person, revision: 2, effectiveFrom: "2026-05-01" }, 1)).status).toBe(
      201,
    )
    expect((await f.write(employee, 2)).status).toBe(422)
    expect(
      await f.database
        .prepare("SELECT id FROM company_employees WHERE id = ?1")
        .bind(employeeId)
        .first(),
    ).toBeNull()
    expect((await f.write({ ...employee, effectiveFrom: "2026-05-01" }, 2)).status).toBe(201)
    expect((await f.write(employment, 3)).status).toBe(422)
    expect((await f.write({ ...employment, effectiveFrom: "2026-05-01" }, 3)).status).toBe(201)
  })

  test("参照される人の有効期間を縮めて在籍中の従業員を消せない", async () => {
    const f = fixture()
    await f.initialize()
    expect((await f.write({ ...person, revision: 2, effectiveTo: "2026-04-01" }, 3)).status).toBe(
      422,
    )
    expect(await f.directory("2026-06-01T00:00:00Z")).toMatchObject({
      officialName: "Example Person",
      employment: { status: "ACTIVE" },
    })
    expect(
      await f.database
        .prepare("SELECT revision FROM company_resource_heads WHERE resource_id = ?1")
        .bind(person.id)
        .first<number>("revision"),
    ).toBe(1)
  })
})
