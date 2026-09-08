import { describe, expect, test, spyOn } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"
import { z } from "zod"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import {
  CompanyResourceEntity,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import * as adoptions from "@/contexts/company/interface/routes/company.responsibility-resource-adoptions"
import { ResponsibilityResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/organization/responsibility-resource-adoption-snapshot.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyGovernanceAuthorityResolutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-governance-authority-resolution.adapter"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"

function resourceProps(resource: CompanyResourceEntity): CompanyResourceProps {
  return {
    organizationId: resource.organizationId,
    type: resource.type,
    id: resource.id,
    revision: resource.revision,
    state: resource.state,
    effectiveFrom: resource.effectiveFrom,
    effectiveTo: resource.effectiveTo,
    attributes: resource.attributes,
  }
}

async function fixture(databaseOverride?: D1Database) {
  const base = await createCompanyAssignmentResourceTestContext(databaseOverride)
  await base.initializeAssignment()
  const repository = new D1CompanyResourceRepository(base.database)
  const define = async (
    resources: ReadonlyArray<CompanyResourceProps>,
    key: string = crypto.randomUUID(),
  ) => {
    const change = CompanyResourceChangeEntity.create({
      commandId: key,
      expectedRevision: await base.companyRevision(),
      actorAccountId: base.creator.accountId,
      recordedAt: base.at.getTime(),
      reason: "Confirm responsibility definitions",
      resources,
    })
    if (change instanceof Error) throw change
    return repository.write(change)
  }
  const envelope = {
    organizationId: "organization:default",
    revision: 1,
    state: "active" as const,
    effectiveFrom: restoreCalendarDate("2030-01-01"),
    effectiveTo: null,
  }
  const definitions: CompanyResourceProps[] = [
    {
      ...envelope,
      type: "responsibility",
      id: "responsibility:manager",
      attributes: { code: "MANAGER", officialName: "Manager" },
    },
    {
      ...envelope,
      type: "responsibility",
      id: "responsibility:people",
      attributes: { code: "PEOPLE_OPERATIONS", officialName: "People Operations" },
    },
    {
      ...envelope,
      type: "authority-scope",
      id: "scope:team",
      attributes: { scopeType: "organization-unit", scopeId: "unit:journal" },
    },
    {
      ...envelope,
      type: "authority-scope",
      id: "scope:root",
      attributes: { scopeType: "organization-unit", scopeId: base.root.id },
    },
  ]
  expect(await define(definitions)).toMatchObject({ kind: "applied" })
  const original = [
    {
      id: "responsibility:legacy-one",
      revision: 1,
      type: "MANAGER",
      startsOn: "2030-01-01",
      endsOn: null,
      isVoid: 0,
    },
    {
      id: "responsibility:legacy-one",
      revision: 2,
      type: "MANAGER",
      startsOn: "2030-02-01",
      endsOn: "2030-04-01",
      isVoid: 0,
    },
    {
      id: "responsibility:legacy-two",
      revision: 1,
      type: "MANAGER",
      startsOn: "2030-06-01",
      endsOn: "2030-09-01",
      isVoid: 0,
    },
    {
      id: "responsibility:legacy-people",
      revision: 1,
      type: "PEOPLE_OPERATIONS",
      startsOn: "2030-03-01",
      endsOn: null,
      isVoid: 0,
    },
    {
      id: "responsibility:legacy-cancelled",
      revision: 1,
      type: "MANAGER",
      startsOn: "2030-10-01",
      endsOn: null,
      isVoid: 1,
    },
  ]
  const revision = await base.database
    .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
    .first<number>("revision")
  await base.database.batch([
    base.database
      .prepare(`INSERT INTO company_organization_change_operations
      (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at, actor_account_id, reason)
      VALUES ('legacy:responsibility-adoption', ?1, 5, 0, ?1 + 5, 'PENDING', 0, ?2, 'Record original responsibility history')`)
      .bind(revision, base.creator.accountId),
    ...original.map((period) =>
      base.database
        .prepare(`INSERT INTO company_organization_responsibility_period_versions
      (period_id, revision, employee_id, employment_id, organization_unit_id, responsibility_type, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES (?1, ?2, ?3, ?4, 'unit:journal', ?5, ?6, ?7, ?8, 'legacy:responsibility-adoption', 0)`)
        .bind(
          period.id,
          period.revision,
          base.creator.employeeId,
          base.assignment.attributes.employmentId,
          period.type,
          period.startsOn,
          period.endsOn,
          period.isVoid,
        ),
    ),
    base.database.prepare(
      "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = 'legacy:responsibility-adoption'",
    ),
  ])
  let actor: CompanyActorValue | undefined = CompanyActorValue.restore({
    ...base.creator,
    organizationIds: ["organization:default"],
    capabilities: ["company:admin"],
  })
  const clock = { now: base.at }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    if (actor !== undefined) context.set("companyActor", actor)
    context.set("companyClock", () => clock.now)
    context.set("database", base.context.var.database)
    context.set("auditContext", base.context.var.auditContext)
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  const routes = app
    .get("/company/responsibility-resource-adoptions", ...adoptions.GET)
    .post("/company/responsibility-resource-adoptions", ...adoptions.POST)
  const client = hc<typeof routes>("http://localhost", {
    fetch: Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        routes.request(input, init, base.context.env),
      { preconnect: fetch.preconnect },
    ),
  })
  const get = (employeeId: string = base.creator.employeeId) =>
    client.company["responsibility-resource-adoptions"].$get({ query: { employee_id: employeeId } })
  const preview = async () => {
    const response = await get()
    expect(Number(response.status)).toBe(200)
    return z
      .object({
        expectedRevision: z.number(),
        snapshotDigest: z.string(),
        observedOn: z.string(),
        snapshot: z.object({ periods: z.array(z.unknown()) }),
      })
      .parse(await response.json())
  }
  const first = await preview()
  const body = {
    employeeId: base.creator.employeeId,
    expectedRevision: first.expectedRevision,
    snapshotDigest: first.snapshotDigest,
    observedOn: first.observedOn,
    reason: "Confirm original responsibility history and definitions",
    mappings: [...new Map(original.map((period) => [period.id, period])).values()].map(
      (period) => ({
        periodId: period.id,
        responsibilityId:
          period.type === "MANAGER" ? "responsibility:manager" : "responsibility:people",
        authorityScopeId: "scope:team",
      }),
    ),
  }
  const adopt = (key = "responsibility:adopt", input = body) =>
    client.company["responsibility-resource-adoptions"].$post({
      header: { "idempotency-key": key },
      json: input,
    })
  const publicOn = async (date: string) => {
    const snapshot = await repository.findMany({
      organizationId: "organization:default",
      types: ["responsibility-assignment"],
      effectiveOn: restoreCalendarDate(date),
    })
    if (!snapshot.ok) throw snapshot.cause
    return snapshot.resources.filter(
      (resource) => resource.readText("holderId") === base.creator.employeeId,
    )
  }
  const state = async () => ({
    base: await base.persisted(),
    responsibility: (
      await base.database
        .prepare(
          "SELECT * FROM company_organization_responsibility_period_versions ORDER BY period_id, revision",
        )
        .all()
    ).results,
    sources: (
      await base.database
        .prepare("SELECT * FROM company_responsibility_resource_bindings ORDER BY resource_id")
        .all()
    ).results,
    bindings: (
      await base.database
        .prepare("SELECT * FROM company_responsibility_period_bindings ORDER BY period_id")
        .all()
    ).results,
    receipts: (
      await base.database
        .prepare("SELECT * FROM company_responsibility_resource_adoptions ORDER BY command_id")
        .all()
    ).results,
  })
  return {
    ...base,
    repository,
    definitions,
    define,
    first,
    body,
    adopt,
    get,
    preview,
    publicOn,
    state,
    clock,
    setAdoptionActor: (next: CompanyActorValue | undefined) => {
      actor = next
    },
  }
}

describe("確認済みの既存責務を公開履歴へ接続する", () => {
  test("全改訂・取消・空白を保持し、資格解決・公開更新・人事発令へ接続する", async () => {
    const f = await fixture()
    const before = await f.state()
    expect(f.first.snapshot.periods).toHaveLength(5)
    const response = await f.adopt()
    expect(await response.json()).toMatchObject({ adoptedPeriods: 4, replayed: false })
    expect(Number(response.status)).toBe(201)
    const saved = await f.state()
    expect(
      saved.responsibility
        .slice()
        .filter((row) => row.recorded_by_action_id === "legacy:responsibility-adoption"),
    ).toEqual(before.responsibility)
    expect(saved.sources).toHaveLength(4)
    expect(Number((await f.adopt()).status)).toBe(200)
    expect(await f.state()).toEqual(saved)
    expect(await f.publicOn("2030-01-31")).toEqual([])
    expect(await f.publicOn("2030-02-01")).toHaveLength(1)
    expect(await f.publicOn("2030-04-01")).toHaveLength(1)
    expect(await f.publicOn("2030-06-01")).toHaveLength(2)
    expect(await f.publicOn("2030-10-01")).toHaveLength(1)
    const resolver = new CompanyGovernanceAuthorityResolutionAdapter({
      repository: f.repository,
      isAccountActive: async () => true,
    })
    expect(
      await resolver.resolve({
        organizationId: "organization:default",
        asOf: restoreCalendarDate("2030-06-01"),
        subjectEmployeeId: null,
        criteria: [
          {
            responsibilityCode: "MANAGER",
            scope: { scopeType: "organization-unit", scopeId: "unit:journal" },
          },
        ],
      }),
    ).toMatchObject({
      kind: "resolved",
      resolution: { candidates: [{ employeeId: f.creator.employeeId }] },
    })
    const manager = (await f.publicOn("2030-02-01"))[0]
    if (manager === undefined) throw new Error("manager missing")
    const change = CompanyResourceEntity.create({
      ...resourceProps(manager),
      revision: 2,
      effectiveTo: restoreCalendarDate("2030-03-15"),
    })
    if (change instanceof Error) throw change
    expect(await f.define([change], "responsibility:public-after-adoption")).toMatchObject({
      kind: "applied",
    })
    expect(
      (await f.state()).responsibility
        .filter((row) => row.period_id === "responsibility:legacy-one")
        .at(-1),
    ).toMatchObject({ ends_on: "2030-03-15" })
    const retired = await f.personnel(
      {
        kind: "retired",
        employeeCode: "EMPLOYEE-001",
        retirementOn: restoreCalendarDate("2030-06-15"),
      },
      "responsibility:retire-after-adoption",
    )
    if (retired instanceof Error) throw retired
    expect(await f.publicOn("2030-06-16")).toEqual([])
    expect(
      await f.personnel(
        {
          kind: "corrected",
          correctsActionId: retired.action.id,
          eventOn: restoreCalendarDate("2030-06-15"),
          reason: "Confirm retirement date",
          replacementAction: {
            kind: "retired",
            employeeCode: "EMPLOYEE-001",
            retirementOn: restoreCalendarDate("2030-06-20"),
          },
        },
        "responsibility:correct-after-adoption",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.publicOn("2030-06-20")).toHaveLength(2)
    expect(await f.publicOn("2030-06-21")).toEqual([])
    expect((await f.database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
    const receipt = await f.database
      .prepare("SELECT source_json, mappings_json FROM company_responsibility_resource_adoptions")
      .first<{ source_json: string; mappings_json: string }>()
    if (receipt === null) throw new Error("receipt missing")
    expect(JSON.parse(receipt.source_json).periods).toEqual(f.first.snapshot.periods)
    expect(JSON.parse(receipt.mappings_json)).toEqual(f.body.mappings)
  })

  test("証跡の保存失敗では全取消し、同じ依頼を再試行して一度だけ接続する", async () => {
    const f = await fixture()
    const before = await f.state()
    await f.database.exec(
      "CREATE TRIGGER reject_responsibility_adoption BEFORE INSERT ON company_responsibility_resource_adoptions BEGIN SELECT RAISE(ABORT, 'injected failure'); END;",
    )
    expect(Number((await f.adopt()).status)).toBe(503)
    expect(await f.state()).toEqual(before)
    await f.database.exec("DROP TRIGGER reject_responsibility_adoption")
    expect(Number((await f.adopt()).status)).toBe(201)
    const saved = await f.state()
    expect(Number((await f.adopt()).status)).toBe(200)
    expect(await f.state()).toEqual(saved)
    for (const sql of [
      "UPDATE company_responsibility_resource_adoptions SET reason = 'Changed'",
      "DELETE FROM company_responsibility_resource_adoptions",
    ]) {
      expect(
        await f.database
          .prepare(sql)
          .run()
          .catch((cause: unknown) => cause),
      ).toBeInstanceOf(Error)
    }
    expect(await f.state()).toEqual(saved)
  })
})

test("同時再送は一度だけ接続し、別の依頼・別の主体・キーの再利用を拒否する", async () => {
  const f = await fixture()
  const responses = await Promise.all([f.adopt(), f.adopt()])
  expect(responses.map((response) => Number(response.status)).sort((a, b) => a - b)).toEqual([
    200, 201,
  ])
  const before = await f.state()
  expect(
    Number(
      (await f.adopt("responsibility:adopt", { ...f.body, reason: "Different confirmation" }))
        .status,
    ),
  ).toBe(409)
  f.setAdoptionActor(
    CompanyActorValue.restore({
      ...f.people[1]!,
      organizationIds: ["organization:default"],
      capabilities: ["company:admin"],
    }),
  )
  expect(Number((await f.adopt()).status)).toBe(409)
  expect(await f.state()).toEqual(before)
  const other = await fixture()
  expect(
    (await Promise.all([other.adopt("responsibility:first"), other.adopt("responsibility:second")]))
      .map((response) => Number(response.status))
      .sort((a, b) => a - b),
  ).toEqual([201, 409])
  expect((await other.state()).receipts).toHaveLength(1)
})

test("保存直前の会社版変更を拒否し、再確認した同じキーで接続する", async () => {
  const f = await fixture()
  const reader = new ResponsibilityResourceAdoptionSnapshotAdapter(f.database)
  const guard = reader.prepareGuard.bind(reader)
  const originalBatch = f.database.batch.bind(f.database)
  const interception = spyOn(
    ResponsibilityResourceAdoptionSnapshotAdapter.prototype,
    "prepareGuard",
  ).mockImplementationOnce((snapshot) => {
    const statement = guard(snapshot)
    spyOn(f.database, "batch").mockImplementationOnce(async (statements) => {
      await f.assignEmployeeCode(f.people[1]!.employeeId, "CONFIRMED-MANAGER")
      return originalBatch(statements)
    })
    return statement
  })
  try {
    expect(Number((await f.adopt()).status)).toBe(409)
  } finally {
    interception.mockRestore()
  }
  const before = await f.state()
  expect(before.receipts).toEqual([])
  expect(before.sources).toEqual([])
  expect(Number((await f.adopt()).status)).toBe(409)
  const next = await f.preview()
  expect(
    Number(
      (
        await f.adopt("responsibility:adopt", {
          ...f.body,
          expectedRevision: next.expectedRevision,
          snapshotDigest: next.snapshotDigest,
          observedOn: next.observedOn,
        })
      ).status,
    ),
  ).toBe(201)
})

test("DB確定後に応答を失っても保存済みの証跡から結果を復元する", async () => {
  const f = await fixture()
  const batch = f.database.batch.bind(f.database)
  let lost = false
  const interception = spyOn(f.database, "batch").mockImplementation(
    async <T>(statements: D1PreparedStatement[]) => {
      const result = await batch<T>(statements)
      const receipt = await f.database
        .prepare(
          "SELECT command_id FROM company_responsibility_resource_adoptions WHERE command_id = 'responsibility:adopt'",
        )
        .first()
      if (!lost && receipt !== null) {
        lost = true
        throw new Error("response lost after commit")
      }
      return result
    },
  )
  try {
    const response = await f.adopt()
    expect(Number(response.status)).toBe(200)
    expect(await response.json()).toMatchObject({ adoptedPeriods: 4, replayed: true })
  } finally {
    interception.mockRestore()
  }
  expect(lost).toBe(true)
  const saved = await f.state()
  expect(saved.receipts).toHaveLength(1)
  expect(Number((await f.adopt()).status)).toBe(200)
  expect(await f.state()).toEqual(saved)
})

test.each([
  "missing-period",
  "duplicate-period",
  "unknown-period",
  "wrong-code",
  "wrong-scope",
  "unknown-definition",
])("確認した期間と定義の対応が一致しない依頼を拒否する: %s", async (kind) => {
  const f = await fixture()
  const mappings = f.body.mappings.map((mapping) => ({ ...mapping }))
  const first = mappings[0]
  if (first === undefined) throw new Error("mapping missing")
  if (kind === "missing-period") mappings.pop()
  if (kind === "duplicate-period") mappings[1] = { ...first }
  if (kind === "unknown-period") first.periodId = "period:unknown"
  if (kind === "wrong-code") first.responsibilityId = "responsibility:people"
  if (kind === "wrong-scope") first.authorityScopeId = "scope:root"
  if (kind === "unknown-definition") first.responsibilityId = "responsibility:missing"
  const before = await f.state()
  expect(Number((await f.adopt("responsibility:invalid", { ...f.body, mappings })).status)).toBe(
    422,
  )
  expect(await f.state()).toEqual(before)
})

test.each(["anonymous", "reader", "other-organization"])(
  "確認・接続・再送は現在の管理資格と会社を検査する: %s",
  async (kind) => {
    const f = await fixture()
    expect(Number((await f.adopt()).status)).toBe(201)
    const before = await f.state()
    f.setAdoptionActor(
      kind === "anonymous"
        ? undefined
        : CompanyActorValue.restore({
            ...f.creator,
            organizationIds: [
              kind === "other-organization" ? "organization:other" : "organization:default",
            ],
            capabilities: [kind === "reader" ? "company:read" : "company:admin"],
          }),
    )
    const status = kind === "anonymous" ? 401 : 403
    expect(Number((await f.get()).status)).toBe(status)
    expect(Number((await f.adopt()).status)).toBe(status)
    expect(await f.state()).toEqual(before)
  },
)

test("確認日の違いと不正な時計を拒否し、履歴の欠落を補完しない", async () => {
  const f = await fixture()
  const before = await f.state()
  expect(Number((await f.get("employee:missing")).status)).toBe(404)
  expect(
    Number(
      (await f.adopt("responsibility:wrong-date", { ...f.body, observedOn: "2035-01-01" })).status,
    ),
  ).toBe(409)
  const now = f.clock.now
  f.clock.now = new Date("invalid")
  expect(Number((await f.get()).status)).toBe(503)
  expect(Number((await f.adopt()).status)).toBe(503)
  expect(await f.state()).toEqual(before)
  f.clock.now = now
  await f.database.exec(
    "DROP TRIGGER company_organization_responsibility_period_versions_immutable_delete",
  )
  await f.database
    .prepare(
      "DELETE FROM company_organization_responsibility_period_versions WHERE period_id = 'responsibility:legacy-one' AND revision = 1",
    )
    .run()
  const broken = await f.preview()
  const brokenState = await f.state()
  expect(
    Number(
      (await f.adopt("responsibility:broken", { ...f.body, snapshotDigest: broken.snapshotDigest }))
        .status,
    ),
  ).toBe(422)
  expect(await f.state()).toEqual(brokenState)
})

test("最新状態が取消でも過去の責務との重複を拒否し、隣接する任用は許可する", async () => {
  const f = await fixture()
  expect(Number((await f.adopt()).status)).toBe(201)
  const original = (await f.publicOn("2030-02-15"))[0]
  if (original === undefined) throw new Error("responsibility missing")
  expect(
    await f.define(
      [
        {
          ...resourceProps(original),
          revision: 2,
          state: "void",
          effectiveFrom: restoreCalendarDate("2030-03-01"),
          effectiveTo: null,
        },
      ],
      "responsibility:future-void",
    ),
  ).toMatchObject({ kind: "applied" })
  const before = await f.state()
  const next = {
    ...resourceProps(original),
    id: "responsibility:independent",
    revision: 1,
    effectiveFrom: restoreCalendarDate("2030-02-15"),
    effectiveTo: restoreCalendarDate("2030-03-15"),
  }
  expect(await f.define([next], "responsibility:historical-overlap")).toMatchObject({
    kind: "invalid",
  })
  expect(await f.state()).toEqual(before)
  expect(
    await f.define(
      [{ ...next, effectiveFrom: restoreCalendarDate("2030-03-01") }],
      "responsibility:adjacent",
    ),
  ).toMatchObject({ kind: "applied" })
})

test("既存の期間重複があるmigrationは一意制約を置換する前に停止する", async () => {
  const files = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
  const migration = files.find((file) =>
    file.endsWith("_record_company_responsibility_resource_adoptions.sql"),
  )
  if (migration === undefined) throw new Error("responsibility adoption migration missing")
  const database = createCompanyD1TestDatabase(
    files
      .filter((file) => file < migration)
      .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
      .join("\n"),
  )
  const f = await fixture(database)
  const responsibility: CompanyResourceProps = {
    organizationId: "organization:default",
    type: "responsibility-assignment",
    id: "overlap:first",
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate("2030-01-01"),
    effectiveTo: null,
    attributes: {
      responsibilityId: "responsibility:manager",
      holderType: "employee",
      holderId: f.creator.employeeId,
      authorityScopeId: "scope:team",
      delegationAllowed: false,
    },
  }
  expect(await f.define([responsibility])).toMatchObject({ kind: "applied" })
  expect(
    await f.define([
      {
        ...responsibility,
        revision: 2,
        state: "void",
        effectiveFrom: restoreCalendarDate("2030-12-01"),
      },
    ]),
  ).toMatchObject({ kind: "applied" })
  expect(
    await f.define([
      { ...responsibility, id: "overlap:second", effectiveFrom: restoreCalendarDate("2030-06-01") },
    ]),
  ).toMatchObject({ kind: "applied" })
  const before = await f.persisted()
  const migrated = await database
    .batch(
      splitSqlStatements(readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, migration), "utf8")).map(
        (sql) => database.prepare(sql),
      ),
    )
    .catch((cause: unknown) => cause)
  expect(migrated).toBeInstanceOf(Error)
  expect(await f.persisted()).toEqual(before)
  expect(
    await database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'company_active_responsibility_assignment_uniq'",
      )
      .first(),
  ).not.toBeNull()
  expect(
    await database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'company_responsibility_resource_adoptions'",
      )
      .first(),
  ).toBeNull()
})

test("期間との接続を欠く保存はDBで拒否し、移行証跡を残さない", async () => {
  const f = await fixture()
  const before = await f.state()
  const prepare = f.database.prepare.bind(f.database)
  const interception = spyOn(f.database, "prepare").mockImplementation((sql) =>
    prepare(
      sql.startsWith("INSERT INTO company_responsibility_period_bindings")
        ? "SELECT ?1, ?2, ?3"
        : sql,
    ),
  )
  try {
    expect(Number((await f.adopt()).status)).toBe(503)
  } finally {
    interception.mockRestore()
  }
  expect(await f.state()).toEqual(before)
  expect(Number((await f.adopt()).status)).toBe(201)
})

test("接続先の定義が責務の全期間を覆わない場合は全体を拒否する", async () => {
  const f = await fixture()
  const scope = f.definitions.find((resource) => resource.id === "scope:team")
  if (scope === undefined) throw new Error("scope missing")
  expect(
    await f.define([{ ...scope, revision: 2, effectiveTo: restoreCalendarDate("2030-04-01") }]),
  ).toMatchObject({ kind: "applied" })
  const preview = await f.preview()
  const before = await f.state()
  expect(
    Number(
      (
        await f.adopt("responsibility:outside-definition", {
          ...f.body,
          expectedRevision: preview.expectedRevision,
          snapshotDigest: preview.snapshotDigest,
        })
      ).status,
    ),
  ).toBe(422)
  expect(await f.state()).toEqual(before)
})

test("百件を超える責務を一括で接続し、後半の失敗でも先頭から取り消す", async () => {
  const f = await fixture()
  const revision = await f.database
    .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
    .first<number>("revision")
  const periods = Array.from({ length: 101 }, (_, index) => ({
    id: `responsibility:bulk-${String(index).padStart(3, "0")}`,
    startsOn: new Date(Date.UTC(2031, 0, 1 + index * 2)).toISOString().slice(0, 10),
    endsOn: new Date(Date.UTC(2031, 0, 2 + index * 2)).toISOString().slice(0, 10),
  }))
  await f.database.batch([
    f.database
      .prepare(`INSERT INTO company_organization_change_operations
      (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at, actor_account_id, reason)
      VALUES ('legacy:bulk-responsibility', ?1, 101, 0, ?1 + 101, 'PENDING', 0, ?2, 'Record separate appointment periods')`)
      .bind(revision, f.creator.accountId),
    ...periods.map((period) =>
      f.database
        .prepare(`INSERT INTO company_organization_responsibility_period_versions
      (period_id, revision, employee_id, employment_id, organization_unit_id, responsibility_type, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES (?1, 1, ?2, ?3, 'unit:journal', 'MANAGER', ?4, ?5, 0, 'legacy:bulk-responsibility', 0)`)
        .bind(
          period.id,
          f.creator.employeeId,
          f.assignment.attributes.employmentId,
          period.startsOn,
          period.endsOn,
        ),
    ),
    f.database.prepare(
      "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = 'legacy:bulk-responsibility'",
    ),
  ])
  const preview = await f.preview()
  const input = {
    ...f.body,
    expectedRevision: preview.expectedRevision,
    snapshotDigest: preview.snapshotDigest,
    observedOn: preview.observedOn,
    mappings: [
      ...f.body.mappings,
      ...periods.map((period) => ({
        periodId: period.id,
        responsibilityId: "responsibility:manager",
        authorityScopeId: "scope:team",
      })),
    ],
  }
  const before = await f.state()
  await f.database
    .exec(`CREATE TRIGGER reject_responsibility_second_command BEFORE INSERT ON company_resource_revisions
    WHEN NEW.command_id = 'responsibility-adoption:${preview.snapshotDigest}:1'
    BEGIN SELECT RAISE(ABORT, 'injected second command failure'); END;`)
  expect(Number((await f.adopt("responsibility:bulk", input)).status)).toBe(503)
  expect(await f.state()).toEqual(before)
  await f.database.exec("DROP TRIGGER reject_responsibility_second_command")
  const response = await f.adopt("responsibility:bulk", input)
  expect(Number(response.status)).toBe(201)
  expect(await response.json()).toMatchObject({
    adoptedPeriods: 105,
    organizationRevision: preview.expectedRevision + 2,
  })
  const saved = await f.state()
  expect(saved.sources).toHaveLength(105)
  expect(Number((await f.adopt("responsibility:bulk", input)).status)).toBe(200)
  expect(await f.state()).toEqual(saved)
}, 60000)
