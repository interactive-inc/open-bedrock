import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { POST as companyBootstrapPOST } from "@/contexts/company/interface/routes/company.bootstrap"
import { GET as profileGET } from "@/contexts/company/interface/routes/company.profile"
import { GET as snapshotsGET } from "@/contexts/company/interface/routes/company.organization-snapshots"
import {
  GET as unitsGET,
  POST as unitsPOST,
} from "@/contexts/company/interface/routes/company.organization-units"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { OrganizationResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/organization/organization-resource-adoption-snapshot.adapter"
import { SystemHTTPException } from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { POST as systemBootstrapPOST } from "@system/interface/routes/system.bootstrap"
import { POST as systemSessionPOST } from "@system/interface/routes/system.sessions"
import { describe, expect, test, spyOn } from "bun:test"
import { hc } from "hono/client"
import { createFactory } from "hono/factory"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { drizzle } from "drizzle-orm/d1"

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
type BootstrapTestEnvironment = {
  Bindings: SystemHonoEnv["Bindings"] & CompanyHttpEnvironment["Bindings"]
  Variables: SystemHonoEnv["Variables"] & CompanyHttpEnvironment["Variables"]
}
const factory = createFactory<BootstrapTestEnvironment>()
const declaration = {
  name: "First Member",
  code: "FIRST-001",
  organization_name: "Example Company",
  representative_name: "Confirmed Representative",
  initial_responsibilities: z.array(z.enum(["MANAGER", "PEOPLE_OPERATIONS"])).parse([]),
  hire_date: "2026-01-01",
  employment_type: z.enum(["FULL_TIME", "PART_TIME"]).parse("PART_TIME"),
  locale: "ja-JP",
  time_zone: "Asia/Tokyo",
  fiscal_year_start_month: 4,
  reason: "Confirmed initial company facts",
}
type BootstrapState = {
  employees: number
  resources: number
  commands: number
  bootstraps: number
  bindings: number
  periods: number
  assignments: number
  responsibilities: number
  revision: number
}
const responseSchema = z.object({
  employee_id: z.string(),
  account_id: z.string(),
  organization_revision: z.number(),
  replayed: z.boolean(),
})

async function fixture() {
  const database = createCompanyD1TestDatabase(schemaSql)
  // 会社情報を事前設定する製品でも、確認済み入力と一致する場合だけ初期化する。
  await database
    .prepare(
      "UPDATE company_organizations SET name = ?1, representative_name = ?2 WHERE id = 'organization:default'",
    )
    .bind(declaration.organization_name, declaration.representative_name)
    .run()
  const clock = { now: new Date() }
  const authorization: {
    organizationIds: string[]
    capabilities: ("company:admin" | "company:read")[]
  } = { organizationIds: ["organization:default"], capabilities: ["company:admin"] }
  const environment = {
    DB: database,
    BOOTSTRAP_TOKEN: "company-bootstrap-test-token",
    JWT_SECRET: "company-bootstrap-test-jwt-secret",
    PEPPER_SECRET: "company-bootstrap-test-pepper",
    AUDIT_HMAC_SECRET: "company-bootstrap-test-audit",
    COMPANY_TIME_ZONE: "Asia/Tokyo",
  }
  const observedOn = resolveCompanyBusinessDate({
    now: clock.now.toISOString(),
    timeZone: environment.COMPANY_TIME_ZONE,
  })
  if (observedOn instanceof Error) throw observedOn
  const app = factory
    .createApp()
    .onError((error, context) => {
      if (!(error instanceof SystemHTTPException || error instanceof CompanyHTTPException))
        throw error
      return context.json({ code: error.code, detail: error.detail }, error.status, {
        "content-type": "application/problem+json",
      })
    })
    .use("*", async (context, next) => {
      context.set("now", () => clock.now)
      await next()
    })
    .post("/system/bootstrap", ...systemBootstrapPOST)
    .post("/system/sessions", ...systemSessionPOST)
    .use("/company/*", authenticateSystemAccessToken)
    .use("/company/*", async (context, next) => {
      context.set(
        "companyActor",
        CompanyActorValue.restore({
          accountId: String(context.var.userId),
          employeeId: null,
          organizationIds: authorization.organizationIds,
          capabilities: authorization.capabilities,
        }),
      )
      context.set("companyClock", () => clock.now)
      context.set("database", drizzle(database))
      context.set("auditContext", {
        requestId: "bootstrap-test",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      })
      await next()
    })
    .post("/company/bootstrap", ...companyBootstrapPOST)
    .get("/company/profile", ...profileGET)
    .get("/company/organization-snapshots", ...snapshotsGET)
    .get("/company/organization-units", ...unitsGET)
    .post("/company/organization-units", ...unitsPOST)
  const request: typeof fetch = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      app.request(input, init, { ...environment, NOW: clock.now.toISOString() }),
    { preconnect: fetch.preconnect },
  )
  const client = hc<typeof app>("http://company.test", { fetch: request })
  expect(
    Number(
      (
        await client.system.bootstrap.$post({
          json: {
            token: environment.BOOTSTRAP_TOKEN,
            email: "root@example.com",
            password: "correct horse battery staple",
          },
        })
      ).status,
    ),
  ).toBe(201)
  const session = await client.system.sessions.$post({
    json: { subject: "root@example.com", password: "correct horse battery staple" },
  })
  expect(Number(session.status)).toBe(201)
  const token = z.object({ access_token: z.string() }).parse(await session.json()).access_token
  const headers = { authorization: `Bearer ${token}` }
  const post = (body = declaration, key = "company:first") =>
    client.company.bootstrap.$post({ header: { "idempotency-key": key }, json: body }, { headers })
  const createUnit = () =>
    client.company["organization-units"].$post(
      { json: { name: "Department", code: "DEPT", parent_code: null } },
      { headers: { ...headers, "idempotency-key": "create:department" } },
    )
  const state = () =>
    database
      .prepare(`SELECT
    (SELECT count(*) FROM company_employees) AS employees,
    (SELECT count(*) FROM company_resource_revisions) AS resources,
    (SELECT count(*) FROM company_command_receipts) AS commands,
    (SELECT count(*) FROM company_bootstrap_receipts) AS bootstraps,
    (SELECT count(*) FROM company_organization_resource_bindings) AS bindings,
    (SELECT count(*) FROM company_organization_unit_period_versions) AS periods,
    (SELECT count(*) FROM company_organization_assignment_period_versions) AS assignments,
    (SELECT count(*) FROM company_organization_responsibility_period_versions) AS responsibilities,
    (SELECT revision FROM company_organizations WHERE id = 'organization:default') AS revision`)
      .first<BootstrapState>()
  return {
    database,
    clock,
    environment,
    authorization,
    app,
    client,
    headers,
    post,
    createUnit,
    state,
    observedOn,
  }
}

describe("Company bootstrap through System authentication", () => {
  test("明示した会社文脈と雇用を公開し、元のルート履歴を保ち、会社責務を自動付与しない", async () => {
    const f = await fixture()
    const original = await f.database
      .prepare("SELECT * FROM company_organization_unit_period_versions")
      .first<Record<string, unknown>>()
    const response = await f.post()
    expect(Number(response.status)).toBe(201)
    const created = responseSchema.parse(await response.json())
    expect(created).toMatchObject({
      employee_id: expect.any(String),
      organization_revision: 3,
      replayed: false,
    })
    expect(await f.state()).toEqual({
      employees: 1,
      resources: 7,
      commands: 3,
      bootstraps: 1,
      bindings: 1,
      periods: 3,
      assignments: 1,
      responsibilities: 0,
      revision: 3,
    })
    expect(
      await f.database
        .prepare(
          "SELECT * FROM company_organization_unit_period_versions WHERE period_id = (SELECT period_id FROM company_organization_unit_period_versions WHERE revision = 2) AND revision = 1",
        )
        .first<Record<string, unknown>>(),
    ).toEqual(original)
    expect(
      await f.database
        .prepare("SELECT employment_type, hire_date FROM company_employments")
        .first<{ employment_type: string; hire_date: string }>(),
    ).toEqual({ employment_type: "PART_TIME", hire_date: declaration.hire_date })
    const profile = await f.client.company.profile.$get(
      { header: { "x-company-organization-id": "organization:default" }, query: {} },
      { headers: f.headers },
    )
    expect(Number(profile.status)).toBe(200)
    const beforeConfirmation = await f.client.company.profile.$get(
      {
        header: { "x-company-organization-id": "organization:default" },
        query: { effective_on: declaration.hire_date },
      },
      { headers: f.headers },
    )
    expect(Number(beforeConfirmation.status)).toBe(200)
    expect(await beforeConfirmation.json()).toMatchObject({ resources: [] })
    expect(await profile.json()).toMatchObject({
      organizationRevision: 3,
      resources: [
        {
          attributes: {
            displayName: declaration.organization_name,
            representativeName: declaration.representative_name,
            locale: "ja-JP",
            timeZone: "Asia/Tokyo",
            fiscalYearStartMonth: 4,
          },
        },
      ],
    })
    const snapshot = await f.client.company["organization-snapshots"].$get(
      {
        header: { "x-company-organization-id": "organization:default" },
        query: { as_of: f.observedOn },
      },
      { headers: f.headers },
    )
    expect(Number(snapshot.status)).toBe(200)
    expect(await snapshot.json()).toMatchObject({
      resources: [
        {
          revision: 1,
          attributes: { officialName: declaration.organization_name, kind: "COMPANY" },
        },
      ],
    })
    const action = await f.database
      .prepare("SELECT payload_fingerprint, summary_json FROM company_personnel_actions")
      .first<{ payload_fingerprint: string; summary_json: string }>()
    if (action === null) throw new Error("initial action missing")
    expect(JSON.parse(action.summary_json)).toMatchObject({
      employmentType: "PART_TIME",
      actorAccountId: created.account_id,
      reason: declaration.reason,
    })
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(action.summary_json),
    )
    expect(action.payload_fingerprint).toBe(
      [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    )
    expect(Number((await f.createUnit()).status)).toBe(201)
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM company_organization_resource_mismatches")
        .first<number>("count"),
    ).toBe(0)
    const before = await f.state()
    f.clock.now = new Date(f.clock.now.getTime() + 86_400_000)
    f.environment.COMPANY_TIME_ZONE = "UTC"
    const replay = await f.post()
    expect(Number(replay.status)).toBe(200)
    expect(await replay.json()).toEqual({ ...created, replayed: true })
    expect(await f.state()).toEqual(before)
    expect(Number((await f.post({ ...declaration, name: "Different" })).status)).toBe(409)
  })

  test.each(["company-profile", "unit-period", "receipt"])(
    "%sの保存失敗を全取消し、同じ依頼で再試行する",
    async (stage) => {
      const f = await fixture()
      const before = await f.state()
      const definitions = new Map([
        [
          "company-profile",
          "BEFORE INSERT ON company_resource_revisions WHEN NEW.resource_type = 'company-profile'",
        ],
        [
          "unit-period",
          "BEFORE INSERT ON company_organization_unit_period_versions WHEN NEW.revision = 2",
        ],
        ["receipt", "BEFORE INSERT ON company_bootstrap_receipts"],
      ])
      const definition = definitions.get(stage)
      if (definition === undefined) throw new Error("stage missing")
      await f.database.exec(
        `CREATE TRIGGER reject_initial_company ${definition} BEGIN SELECT RAISE(ABORT, 'storage unavailable'); END;`,
      )
      expect(Number((await f.post()).status)).toBe(503)
      expect(await f.state()).toEqual(before)
      expect(
        await f.database
          .prepare("SELECT count(*) AS count FROM system_bootstrap_state")
          .first<number>("count"),
      ).toBe(1)
      await f.database.exec("DROP TRIGGER reject_initial_company")
      expect(Number((await f.post()).status)).toBe(201)
    },
  )

  test("同じ初期化の同時実行は一回だけ保存し、別の依頼は競合として返す", async () => {
    const f = await fixture()
    const responses = await Promise.all([f.post(), f.post()])
    expect(responses.map((response) => Number(response.status)).toSorted((a, b) => a - b)).toEqual([
      200, 201,
    ])
    expect(await f.state()).toMatchObject({ employees: 1, bootstraps: 1, revision: 3 })
    expect(Number((await f.post(declaration, "different-command")).status)).toBe(409)
    const erased = await f.database
      .prepare("DELETE FROM company_bootstrap_receipts")
      .run()
      .catch((cause: unknown) => cause)
    if (!(erased instanceof Error)) throw new Error("bootstrap receipt was deleted")
    expect(erased.message).toContain("immutable")
  })

  test("代表者を従業員から推測せず、明示した責務だけを確認当日から割り当てる", async () => {
    const f = await fixture()
    const response = await f.post({
      ...declaration,
      initial_responsibilities: ["MANAGER", "PEOPLE_OPERATIONS"],
    })
    expect(Number(response.status)).toBe(201)
    expect(
      await f.database
        .prepare(
          "SELECT name, representative_name FROM company_organizations WHERE id = 'organization:default'",
        )
        .first<{ name: string; representative_name: string }>(),
    ).toEqual({
      name: declaration.organization_name,
      representative_name: declaration.representative_name,
    })
    const responsibilities = await f.database
      .prepare(
        "SELECT responsibility_type, starts_on FROM company_organization_responsibility_period_versions ORDER BY responsibility_type",
      )
      .all<{ responsibility_type: string; starts_on: string }>()
    expect(responsibilities.results).toEqual([
      { responsibility_type: "MANAGER", starts_on: f.observedOn },
      { responsibility_type: "PEOPLE_OPERATIONS", starts_on: f.observedOn },
    ])
    const proof = await f.database
      .prepare(
        "SELECT operation.request_fingerprint AS actual, receipt.fingerprint AS expected FROM company_organization_change_operations operation JOIN company_bootstrap_receipts receipt ON receipt.actor_account_id = operation.actor_account_id WHERE operation.reason = ?1",
      )
      .bind(declaration.reason)
      .first<{ actual: string; expected: string }>()
    if (proof === null) throw new Error("initial authority proof missing")
    expect(proof.actual).toBe(proof.expected)
  })

  test("認証・会社範囲・管理資格を参照済みの再送にも適用する", async () => {
    const f = await fixture()
    expect(
      Number(
        (
          await f.client.company.bootstrap.$post({
            header: { "idempotency-key": "company:first" },
            json: declaration,
          })
        ).status,
      ),
    ).toBe(401)
    f.authorization.organizationIds = ["organization:other"]
    expect(Number((await f.post()).status)).toBe(403)
    f.authorization.organizationIds = ["organization:default"]
    f.authorization.capabilities = ["company:read"]
    expect(Number((await f.post()).status)).toBe(403)
    f.authorization.capabilities = ["company:admin"]
    expect(Number((await f.post()).status)).toBe(201)
    f.authorization.organizationIds = ["organization:other"]
    expect(Number((await f.post()).status)).toBe(403)
  })

  test("確認なしの旧入力・未来の入社・実行環境と異なるtimezoneを保存しない", async () => {
    const f = await fixture()
    const invalid = await f.client.company.bootstrap.$post(
      { header: { "idempotency-key": "company:first" }, json: declaration },
      { headers: f.headers, init: { body: JSON.stringify({ name: "First Member" }) } },
    )
    expect(Number(invalid.status)).toBe(400)
    expect(Number((await f.post({ ...declaration, hire_date: "2999-01-01" })).status)).toBe(422)
    expect(Number((await f.post({ ...declaration, time_zone: "UTC" })).status)).toBe(409)
    expect(await f.state()).toMatchObject({
      employees: 0,
      resources: 0,
      bootstraps: 0,
      revision: 0,
    })
  })

  test("既存の会社名や部署を初期化で上書きしない", async () => {
    const f = await fixture()
    expect(
      Number(
        (await f.post({ ...declaration, representative_name: "Other Representative" })).status,
      ),
    ).toBe(409)
    expect(
      Number((await f.post({ ...declaration, organization_name: "Other Company" })).status),
    ).toBe(409)
    await f.database.exec(
      "UPDATE company_organizations SET name = 'Existing Company' WHERE id = 'organization:default'",
    )
    expect(Number((await f.post()).status)).toBe(409)
    expect(
      await f.database
        .prepare("SELECT name FROM company_organizations WHERE id = 'organization:default'")
        .first<string>("name"),
    ).toBe("Existing Company")
    await f.database
      .prepare("UPDATE company_organizations SET name = ?1 WHERE id = 'organization:default'")
      .bind(declaration.organization_name)
      .run()
    expect(Number((await f.createUnit()).status)).toBe(201)
    expect(Number((await f.post()).status)).toBe(409)
    expect(await f.state()).toMatchObject({ employees: 0, resources: 0, periods: 2 })
  })

  test.each(["organization", "profile"])("確認直後の%s変更も同じbatchで検出する", async (kind) => {
    const f = await fixture()
    const adapter = new OrganizationResourceAdoptionSnapshotAdapter(f.database)
    const prepare = adapter.prepareGuard.bind(adapter)
    const interception = spyOn(
      OrganizationResourceAdoptionSnapshotAdapter.prototype,
      "prepareGuard",
    ).mockImplementationOnce((snapshot) => {
      const guard = prepare(snapshot)
      const batch = f.database.batch.bind(f.database)
      spyOn(f.database, "batch").mockImplementationOnce(async (statements) => {
        if (kind === "organization") expect(Number((await f.createUnit()).status)).toBe(201)
        else
          await f.database.exec(
            "UPDATE company_organizations SET representative_name = 'Changed Representative' WHERE id = 'organization:default'",
          )
        return batch(statements)
      })
      return guard
    })
    try {
      expect(Number((await f.post()).status)).toBe(409)
    } finally {
      interception.mockRestore()
    }
    expect(await f.state()).toMatchObject({
      employees: 0,
      resources: 0,
      bootstraps: 0,
      periods: kind === "organization" ? 2 : 1,
    })
  })
})
