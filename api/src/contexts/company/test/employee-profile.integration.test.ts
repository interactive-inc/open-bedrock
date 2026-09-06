import { describe, expect, test, spyOn } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { Hono } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { employeeProfileVersionSchema } from "@/contexts/company/domain/entities/employee-profile-change.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import {
  GET as GET_NAME,
  PUT as PUT_NAME,
} from "@/contexts/company/interface/routes/company.employee-directory.$code"
import {
  GET as GET_PHONE,
  PUT as PUT_PHONE,
} from "@/contexts/company/interface/routes/company.my-profile"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
const employeeId = "employee:profile"
const responseSchema = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  profile: employeeProfileVersionSchema.nullable(),
})

async function fixture() {
  const database = createCompanyD1TestDatabase(schemaSql)
  const clock = { now: new Date("2026-06-01T15:00:00Z") }
  const actor = CompanyActorValue.restore({
    accountId: "account:profile",
    employeeId,
    organizationIds: ["organization:default"],
    capabilities: [],
    permissions: ["employee:read", "employee:write:basic"],
  })
  const actors = { current: actor }
  const environment = { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo" }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    context.set("companyActor", actors.current)
    context.set("companyClock", () => clock.now)
    context.set("database", drizzle(database))
    context.set("auditContext", {
      requestId: crypto.randomUUID(),
      clientName: "api",
      clientIp: null,
      externalRequestId: null,
    })
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  app
    .get("/company/employee-directory/:code", ...GET_NAME)
    .put("/company/employee-directory/:code", ...PUT_NAME)
    .get("/company/my-profile", ...GET_PHONE)
    .put("/company/my-profile", ...PUT_PHONE)
  const initial = CompanyResourceChangeEntity.create({
    commandId: "profile:initial",
    expectedRevision: 0,
    actorAccountId: actor.accountId,
    reason: "Record confirmed workforce facts",
    recordedAt: 0,
    resources: [
      {
        organizationId: "organization:default",
        type: "person",
        id: "person:profile",
        revision: 1,
        state: "active",
        effectiveFrom: restoreCalendarDate("2026-01-01"),
        effectiveTo: null,
        attributes: {
          officialName: "Example Person",
          email: "you@example.com",
          phone: "010-1000-1000",
        },
      },
      {
        organizationId: "organization:default",
        type: "employee",
        id: employeeId,
        revision: 1,
        state: "active",
        effectiveFrom: restoreCalendarDate("2026-01-01"),
        effectiveTo: null,
        attributes: { personId: "person:profile", employeeCode: "PROFILE-001" },
      },
      {
        organizationId: "organization:default",
        type: "employment",
        id: "employment:profile",
        revision: 1,
        state: "active",
        effectiveFrom: restoreCalendarDate("2026-01-01"),
        effectiveTo: null,
        attributes: { employeeId, status: "ACTIVE", employmentType: "FULL_TIME" },
      },
    ],
  })
  if (initial instanceof Error) throw initial
  expect(await new D1CompanyResourceRepository(database).write(initial)).toMatchObject({
    kind: "applied",
  })
  await database.exec(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      VALUES ('account:profile', 'active', 0, 0, 0), ('account:unlinked', 'active', 0, 0, 0);
    INSERT INTO company_account_employee_links (account_id, employee_id) VALUES ('account:profile', 'employee:profile');
    INSERT INTO company_account_profiles (organization_id, account_id, display_name, created_at, updated_at)
      VALUES ('organization:default', 'account:profile', 'Example Person', 0, 0),
      ('organization:default', 'account:unlinked', 'Unlinked Person', 0, 0);`)
  const read = (path = "/company/my-profile") => app.request(path, {}, environment)
  const version = async () => {
    const response = await read()
    expect(response.status).toBe(200)
    const profile = responseSchema.parse(await response.json()).profile
    if (profile === null) throw new Error("missing profile")
    return profile
  }
  const write = (
    body: Record<string, unknown>,
    key = "profile-change",
    path = "/company/my-profile",
  ) =>
    app.request(
      path,
      {
        method: "PUT",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({ reason: "Confirm corrected personal details", ...body }),
      },
      environment,
    )
  const counts = () =>
    database
      .prepare(`SELECT
    (SELECT count(*) FROM company_resource_revisions WHERE resource_type = 'person') AS revisions,
    (SELECT count(*) FROM company_command_receipts) AS receipts,
    (SELECT revision FROM company_organizations WHERE id = 'organization:default') AS organization_revision`)
      .first<{ revisions: number; receipts: number; organization_revision: number }>()
  const rows = () =>
    database
      .prepare("SELECT official_name, email, phone FROM company_employees WHERE id = ?1")
      .bind(employeeId)
      .first<{ official_name: string; email: string | null; phone: string | null }>()
  return { database, clock, actors, actor, read, version, write, counts, rows, app, environment }
}

describe("employee profile writes share the public Person history", () => {
  test("氏名の成功応答、名簿、人物履歴、Account表示名が一致し、過去の氏名を保全する", async () => {
    const context = await fixture()
    const profile = await context.version()
    const response = await context.write(
      { name: "Changed Person", profile },
      "name-change",
      "/company/employee-directory/PROFILE-001",
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ name: "Changed Person", replayed: false })
    expect(
      await (await context.read("/company/employee-directory/PROFILE-001")).json(),
    ).toMatchObject({ name: "Changed Person" })
    expect(await context.rows()).toEqual({
      official_name: "Changed Person",
      email: "you@example.com",
      phone: "010-1000-1000",
    })
    expect(
      (
        await context.database
          .prepare(
            "SELECT account_id, display_name FROM company_account_profiles ORDER BY account_id",
          )
          .all<{ account_id: string; display_name: string }>()
      ).results,
    ).toEqual([
      { account_id: "account:profile", display_name: "Changed Person" },
      { account_id: "account:unlinked", display_name: "Unlinked Person" },
    ])
    const history = await new D1CompanyResourceRepository(context.database).findMany({
      organizationId: "organization:default",
      types: ["person"],
      effectiveOn: restoreCalendarDate("2026-06-01"),
    })
    expect(history.ok && history.resources[0]?.readText("officialName")).toBe("Example Person")
    expect(
      await context.database
        .prepare(
          "SELECT actor_account_id, reason, effective_from FROM company_resource_revisions WHERE resource_type = 'person' AND revision = 2",
        )
        .first<{ actor_account_id: string; reason: string; effective_from: string }>(),
    ).toEqual({
      actor_account_id: "account:profile",
      reason: "officialName: Confirm corrected personal details",
      effective_from: "2026-06-02",
    })
  })

  test("電話番号だけを変え、nullで削除でき、氏名とemailを巻き戻さない", async () => {
    const context = await fixture()
    expect(
      (
        await context.write(
          { name: "Changed Person", profile: await context.version() },
          "rename",
          "/company/employee-directory/PROFILE-001",
        )
      ).status,
    ).toBe(200)
    expect(
      (await context.write({ phone: "020-2000-2000", profile: await context.version() })).status,
    ).toBe(200)
    expect(await context.rows()).toEqual({
      official_name: "Changed Person",
      email: "you@example.com",
      phone: "020-2000-2000",
    })
    expect(
      (await context.write({ phone: null, profile: await context.version() }, "clear-phone"))
        .status,
    ).toBe(200)
    expect(await (await context.read()).json()).toMatchObject({
      name: "Changed Person",
      phone: null,
    })
  })

  test("古い画面の更新を拒否し、後続変更後の再送も元の結果を返して履歴を増やさない", async () => {
    const context = await fixture()
    const profile = await context.version()
    const body = { phone: "020-2000-2000", profile }
    expect((await context.write(body)).status).toBe(200)
    expect((await context.write({ phone: "030-3000-3000", profile }, "stale")).status).toBe(409)
    expect(
      (await context.write({ phone: null, profile: await context.version() }, "clear")).status,
    ).toBe(200)
    const before = await context.counts()
    const replay = await context.write(body)
    expect(replay.status).toBe(200)
    expect(await replay.json()).toMatchObject({ phone: "020-2000-2000", replayed: true })
    expect(await context.counts()).toEqual(before)
    expect(await context.rows()).toMatchObject({ phone: null })
    expect((await context.write({ ...body, phone: "040-4000-4000" })).status).toBe(409)
  })

  test("他人の電話、会社範囲外、氏名変更権限なし、従業員番号の取り違えを拒否する", async () => {
    const context = await fixture()
    const profile = await context.version()
    expect(
      (await context.write({ phone: null, profile: { ...profile, employeeId: "employee:other" } }))
        .status,
    ).toBe(403)
    context.actors.current = CompanyActorValue.restore({
      accountId: "account:profile",
      employeeId,
      organizationIds: ["organization:other"],
      capabilities: ["company:admin"],
    })
    expect((await context.write({ phone: null, profile })).status).toBe(403)
    context.actors.current = CompanyActorValue.restore({
      accountId: "account:profile",
      employeeId,
      organizationIds: ["organization:default"],
      capabilities: [],
    })
    expect(
      (
        await context.write(
          { name: "Changed Person", profile },
          "name",
          "/company/employee-directory/PROFILE-001",
        )
      ).status,
    ).toBe(403)
    context.actors.current = context.actor
    expect(
      (
        await context.write(
          { name: "Changed Person", profile },
          "wrong-code",
          "/company/employee-directory/WRONG",
        )
      ).status,
    ).toBe(409)
    expect(await context.counts()).toEqual({ revisions: 1, receipts: 1, organization_revision: 1 })
  })

  test("版・冪等キーのない旧契約と未知の項目を受け付けない", async () => {
    const context = await fixture()
    expect((await context.write({ phone: null })).status).toBe(400)
    expect(
      (
        await context.write({
          phone: null,
          profile: await context.version(),
          email: "other@example.com",
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await context.app.request(
          "/company/my-profile",
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              phone: null,
              profile: await context.version(),
              reason: "Confirmed change",
            }),
          },
          context.environment,
        )
      ).status,
    ).toBe(400)
  })

  test("Account表示名の保存失敗は人物履歴・従業員表示・commandも取り消す", async () => {
    const context = await fixture()
    const profile = await context.version()
    const before = await context.counts()
    await context.database.exec(
      "CREATE TRIGGER reject_profile_update BEFORE UPDATE ON company_account_profiles BEGIN SELECT RAISE(ABORT, 'profile_update_rejected'); END;",
    )
    expect(
      (
        await context.write(
          { name: "Changed Person", profile },
          "failed",
          "/company/employee-directory/PROFILE-001",
        )
      ).status,
    ).toBe(503)
    expect(await context.counts()).toEqual(before)
    expect(await context.rows()).toMatchObject({ official_name: "Example Person" })
    await context.database.exec("DROP TRIGGER reject_profile_update;")
    expect(
      (
        await context.write(
          { name: "Changed Person", profile },
          "failed",
          "/company/employee-directory/PROFILE-001",
        )
      ).status,
    ).toBe(200)
  })

  test("200文字の氏名を切り詰めず保存する", async () => {
    const context = await fixture()
    const name = "名".repeat(200)
    expect(
      (
        await context.write(
          { name, profile: await context.version() },
          "long-name",
          "/company/employee-directory/PROFILE-001",
        )
      ).status,
    ).toBe(200)
    expect(await context.rows()).toMatchObject({ official_name: name })
  })

  test("営業日を越えた未保存の編集を拒否し、前日の成功操作は再送できる", async () => {
    const context = await fixture()
    const profile = await context.version()
    const body = { phone: null, profile }
    expect((await context.write(body)).status).toBe(200)
    context.clock.now = new Date("2026-06-02T15:00:00Z")
    expect((await context.write(body, "new-after-midnight")).status).toBe(409)
    expect((await context.write(body)).status).toBe(200)
  })
  test("保存直前の公開Person更新と競合しても片方だけを確定する", async () => {
    const context = await fixture()
    const profile = await context.version()
    const competing = CompanyResourceChangeEntity.create({
      commandId: "competing-person",
      expectedRevision: profile.organizationRevision,
      actorAccountId: context.actor.accountId,
      reason: "Correct confirmed email",
      recordedAt: context.clock.now.getTime(),
      resources: [
        {
          organizationId: "organization:default",
          type: "person",
          id: "person:profile",
          revision: 2,
          state: "active",
          effectiveFrom: restoreCalendarDate(profile.effectiveOn),
          effectiveTo: null,
          attributes: {
            officialName: "Example Person",
            email: "changed@example.com",
            phone: "010-1000-1000",
          },
        },
      ],
    })
    if (competing instanceof Error) throw competing
    const batch = context.database.batch.bind(context.database)
    const interception = spyOn(context.database, "batch").mockImplementationOnce(
      async (statements) => {
        expect(
          await new D1CompanyResourceRepository(context.database).write(competing),
        ).toMatchObject({ kind: "applied" })
        return batch(statements)
      },
    )
    try {
      expect((await context.write({ phone: null, profile })).status).toBe(409)
      expect(await context.rows()).toEqual({
        official_name: "Example Person",
        email: "changed@example.com",
        phone: "010-1000-1000",
      })
      expect(await context.counts()).toEqual({
        revisions: 2,
        receipts: 2,
        organization_revision: 2,
      })
    } finally {
      interception.mockRestore()
    }
  })

  test("将来の人物変更があっても現在の値を編集し、予約された区間を保全する", async () => {
    const context = await fixture()
    const future = CompanyResourceChangeEntity.create({
      commandId: "future-person",
      expectedRevision: 1,
      actorAccountId: context.actor.accountId,
      reason: "Schedule confirmed name",
      recordedAt: context.clock.now.getTime(),
      resources: [
        {
          organizationId: "organization:default",
          type: "person",
          id: "person:profile",
          revision: 2,
          state: "active",
          effectiveFrom: restoreCalendarDate("2026-07-01"),
          effectiveTo: null,
          attributes: {
            officialName: "Future Person",
            email: "you@example.com",
            phone: "010-1000-1000",
          },
        },
      ],
    })
    if (future instanceof Error) throw future
    expect(await new D1CompanyResourceRepository(context.database).write(future)).toMatchObject({
      kind: "applied",
    })
    expect(await (await context.read()).json()).toMatchObject({
      name: "Example Person",
      profile: { personRevision: 2 },
    })
    expect((await context.write({ phone: null, profile: await context.version() })).status).toBe(
      200,
    )
    expect(await context.rows()).toEqual({
      official_name: "Example Person",
      email: "you@example.com",
      phone: null,
    })
    const scheduled = await new D1CompanyResourceRepository(context.database).findMany({
      organizationId: "organization:default",
      types: ["person"],
      effectiveOn: restoreCalendarDate("2026-07-01"),
    })
    expect(scheduled.ok && scheduled.resources[0]?.readText("officialName")).toBe("Future Person")
    expect(scheduled.ok && scheduled.resources[0]?.readText("phone")).toBe("010-1000-1000")
  })

  test("公開正本に未接続の従業員は版を返さず、片方だけ更新しない", async () => {
    const context = await fixture()
    await context.database.exec(
      "INSERT INTO company_employees (id, official_name, employee_code, email, phone, created_at, updated_at) VALUES ('employee:legacy', 'Legacy Person', 'LEGACY-001', NULL, NULL, 0, 0);",
    )
    context.actors.current = CompanyActorValue.restore({
      accountId: "account:profile",
      employeeId: "employee:legacy",
      organizationIds: ["organization:default"],
      capabilities: [],
    })
    expect(responseSchema.parse(await (await context.read()).json())).toEqual({
      name: "Legacy Person",
      phone: null,
      profile: null,
    })
    expect(
      (
        await context.write({
          phone: "020-2000-2000",
          profile: {
            employeeId: "employee:legacy",
            personRevision: 1,
            organizationRevision: 1,
            effectiveOn: "2026-06-02",
          },
        })
      ).status,
    ).toBe(409)
    expect(await context.counts()).toEqual({ revisions: 1, receipts: 1, organization_revision: 1 })
    expect(
      await context.database
        .prepare("SELECT phone FROM company_employees WHERE id = 'employee:legacy'")
        .first<{ phone: string | null }>(),
    ).toEqual({ phone: null })
  })
})
