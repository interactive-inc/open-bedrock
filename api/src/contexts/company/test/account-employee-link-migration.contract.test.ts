import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { createExternalIdentityImportTestContext } from "@/contexts/company/test/external-identity-import.test-support"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyAccountEmployeeLinksReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-account-employee-links-read.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"

async function fixture() {
  const files = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
  const first = files.find((file) => file.endsWith("_bind_company_account_employee_resources.sql"))
  if (first === undefined) throw new Error("missing Account link migration")
  const database = createCompanyD1TestDatabase(
    files
      .filter((file) => file < first)
      .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
      .join("\n"),
  )
  const c = await createExternalIdentityImportTestContext("oidc", database)
  expect((await c.application.execute(c.input)).kind).toBe("applied")
  const repository = new D1CompanyResourceRepository(database)
  const resources = await repository.findMany({
    organizationId: "organization:default",
    types: ["account-employee-link"],
  })
  if (!resources.ok) throw resources.cause
  const link = resources.resources[0]
  if (link === undefined) throw new Error("existing public correspondence missing")
  const revise = async (attributes = link.attributes) => {
    const revision = await database
      .prepare("SELECT revision FROM company_organizations WHERE id = 'organization:default'")
      .first<number>("revision")
    if (revision === null) throw new Error("organization missing")
    const change = CompanyResourceChangeEntity.create({
      commandId: crypto.randomUUID(),
      expectedRevision: revision,
      actorAccountId: c.actor.accountId,
      reason: "Confirm existing correspondence history",
      recordedAt: c.clock.at.getTime(),
      resources: [
        {
          organizationId: link.organizationId,
          type: link.type,
          id: link.id,
          revision: 2,
          state: "void",
          effectiveFrom: link.effectiveFrom,
          effectiveTo: link.effectiveTo,
          attributes,
        },
      ],
    })
    if (change instanceof Error) throw change
    expect((await repository.write(change)).kind).toBe("applied")
  }
  const migrate = async () => {
    for (const file of files.filter((file) => file >= first))
      await database.batch(
        splitSqlStatements(readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8")).map(
          (sql) => database.prepare(sql),
        ),
      )
  }
  return { ...c, link, revise, migrate }
}

describe("Account対応の履歴接続migration", () => {
  test("既存の対応・rowid・公開履歴を保全し、取消済みの対応を復活させない", async () => {
    const c = await fixture()
    await c.revise()
    await c.database.exec(`
      INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
        VALUES ('legacy-account', 'active', 0, 0, 0);
      INSERT INTO company_employees (id, official_name, employee_code, email, phone, created_at, updated_at)
        VALUES ('legacy-employee', 'Legacy Person', NULL, NULL, NULL, 0, 0);
      INSERT INTO company_account_employee_links (account_id, employee_id) VALUES ('legacy-account', 'legacy-employee');
    `)
    const anchors = (
      await c.database
        .prepare(
          "SELECT rowid, account_id, employee_id FROM company_account_employee_links ORDER BY rowid",
        )
        .all()
    ).results
    const history = (
      await c.database
        .prepare(
          "SELECT * FROM company_resource_revisions ORDER BY organization_revision, resource_type, resource_id, revision",
        )
        .all()
    ).results
    await c.migrate()
    for (const column of ["account_id", "employee_id"]) {
      const plan = await c.database
        .prepare(`EXPLAIN QUERY PLAN SELECT account_id, employee_id
        FROM company_account_employee_link_periods WHERE ${column} = ?1
          AND (starts_on IS NULL OR starts_on <= '2030-01-01')
          AND (ends_on IS NULL OR '2030-01-01' < ends_on)`)
        .bind("legacy-account")
        .all<{ detail: string }>()
      expect(plan.results.some((row) => /^SCAN (resource|latest|later)\b/.test(row.detail))).toBe(
        false,
      )
    }
    expect(
      (
        await c.database
          .prepare(
            "SELECT rowid, account_id, employee_id FROM company_account_employee_links ORDER BY rowid",
          )
          .all()
      ).results,
    ).toEqual(anchors)
    expect(
      (
        await c.database
          .prepare(
            "SELECT * FROM company_resource_revisions ORDER BY organization_revision, resource_type, resource_id, revision",
          )
          .all()
      ).results,
    ).toEqual(history)
    expect(
      await new CompanyAccountEmployeeLinksReadAdapter({ env: { DB: c.database } }).findMany({
        asOf: restoreCalendarDate("2030-01-01"),
      }),
    ).toEqual([
      {
        accountId: restoreWorkforceId("system_account", "legacy-account"),
        employeeId: restoreWorkforceId("employee", "legacy-employee"),
      },
    ])
    expect(
      (
        await c.database
          .prepare(
            "SELECT account_id, starts_on, ends_on, source FROM company_account_employee_link_periods",
          )
          .all()
      ).results,
    ).toEqual([{ account_id: "legacy-account", starts_on: null, ends_on: null, source: "legacy" }])
    expect((await c.database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
  })

  test("所有者が入れ替わった既存履歴を推測で修復せず、移行を拒否する", async () => {
    const c = await fixture()
    await c.revise({ ...c.link.attributes, accountId: c.actor.accountId })
    expect(
      await c.database
        .prepare(
          "SELECT count(DISTINCT json_extract(attributes_json, '$.accountId')) AS total FROM company_resource_revisions WHERE resource_type = 'account-employee-link'",
        )
        .first<number>("total"),
    ).toBe(2)
    const anchors = (
      await c.database
        .prepare("SELECT account_id, employee_id FROM company_account_employee_links")
        .all()
    ).results
    const failure = await c.migrate().then(
      () => null,
      (cause: unknown) => cause,
    )
    expect(failure).toBeInstanceOf(Error)
    expect(
      (
        await c.database
          .prepare("SELECT account_id, employee_id FROM company_account_employee_links")
          .all()
      ).results,
    ).toEqual(anchors)
  })
})
