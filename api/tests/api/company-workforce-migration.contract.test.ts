import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"

const directory = join(import.meta.dir, "../../migrations")
const migrationName = "0080_guard_company_workforce_resources.sql"
const migration = readFileSync(join(directory, migrationName), "utf8")
const before = readdirSync(directory)
  .filter((name) => name.endsWith(".sql") && name < migrationName)
  .toSorted()
  .map((name) => readFileSync(join(directory, name), "utf8"))
  .join("\n")

describe("Company workforce resource migration", () => {
  test("projection導入は既存の業務台帳と公開履歴を改変せず、所有関係を推測しない", async () => {
    const existingSchema = readdirSync(directory)
      .filter((name) => name.endsWith(".sql") && name < "0081")
      .sort()
      .map((name) => readFileSync(join(directory, name), "utf8"))
      .join("\n")
    const database = createCompanyD1TestDatabase(existingSchema)
    await database.exec(`INSERT INTO company_employees (id, official_name, employee_code, created_at, updated_at)
      VALUES ('employee:legacy', 'Example Existing', 'EXISTING-001', 1, 1);
      INSERT INTO company_employments
        (id, employee_id, contract_name, employment_type, hire_date, status, termination_date, created_at, updated_at)
        VALUES ('employment:legacy', 'employee:legacy', 'Example Existing', 'FULL_TIME', '2020-01-01', 'ACTIVE', NULL, 1, 1);`)
    const employees = (await database.prepare("SELECT * FROM company_employees").all()).results
    const employments = (await database.prepare("SELECT * FROM company_employments").all()).results
    for (const name of [
      "0081_bind_company_workforce_resources.sql",
      "0082_guard_company_workforce_projection.sql",
    ])
      await database.exec(readFileSync(join(directory, name), "utf8"))
    expect((await database.prepare("SELECT * FROM company_employees").all()).results).toEqual(
      employees,
    )
    expect((await database.prepare("SELECT * FROM company_employments").all()).results).toEqual(
      employments,
    )
    expect(
      await database.prepare("SELECT * FROM company_workforce_resource_bindings").first(),
    ).toBeNull()
    expect(await database.prepare("SELECT * FROM company_personnel_actions").first()).toBeNull()
    const shared = createCompanyD1TestDatabase(
      readFileSync(
        join(import.meta.dir, "../../src/contexts/company/infrastructure/schema/company.sql"),
        "utf8",
      ),
    )
    const query =
      "SELECT name, sql FROM sqlite_master WHERE name IN ('company_workforce_resource_bindings', 'company_workforce_projection_guard', 'company_employments_employee_active_unique') ORDER BY name"
    expect((await database.prepare(query).all()).results).toEqual(
      (await shared.prepare(query).all()).results,
    )
  })

  test("既存データを消さず、共有schemaと同じguardを導入する", async () => {
    const database = createCompanyD1TestDatabase(before)
    const repository = new D1CompanyResourceRepository(database)
    const change = CompanyResourceChangeEntity.create({
      commandId: "command:existing",
      expectedRevision: 0,
      actorAccountId: "account:operator",
      reason: "既存データ",
      recordedAt: 1,
      resources: [
        {
          organizationId: "organization:default",
          type: "employee",
          id: "employee:existing",
          revision: 1,
          state: "active",
          effectiveFrom: restoreCalendarDate("2026-01-01"),
          effectiveTo: null,
          attributes: { personId: "person:missing" },
        },
      ],
    })
    if (change instanceof Error) throw change
    const canonical = CanonicalSystemJsonValue.create({
      expectedRevision: change.expectedRevision,
      actorAccountId: change.actorAccountId,
      reason: change.reason,
      resources: change.resources.map((resource) => ({
        organizationId: resource.organizationId,
        type: resource.type,
        id: resource.id,
        revision: resource.revision,
        state: resource.state,
        effectiveFrom: resource.effectiveFrom,
        effectiveTo: resource.effectiveTo,
        attributes: resource.attributes,
      })),
    })
    if (canonical instanceof Error) throw canonical
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonical.toString()),
    )
    const fingerprint = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
    await database.batch([
      database.prepare(
        "INSERT OR IGNORE INTO company_organizations (id, revision, created_at, updated_at) VALUES ('organization:default', 0, 1, 1)",
      ),
      database
        .prepare(`INSERT INTO company_command_receipts
        (organization_id, command_id, fingerprint, expected_revision, organization_revision, recorded_at)
        VALUES ('organization:default', 'command:existing', ?1, 0, 1, 1)`)
        .bind(fingerprint),
      database.prepare(`INSERT INTO company_resource_revisions
        (organization_id, resource_type, resource_id, revision, organization_revision, state, effective_from,
         effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
        VALUES ('organization:default', 'employee', 'employee:existing', 1, 1, 'active', '2026-01-01',
          NULL, '{"personId":"person:missing"}', 'command:existing', 'account:operator', '既存データ', 1)`),
      database.prepare(
        "UPDATE company_organizations SET revision = 1 WHERE id = 'organization:default'",
      ),
    ])
    const original = await database.prepare("SELECT * FROM company_resource_revisions").all()
    await database.exec(migration)
    expect(
      (await database.prepare("SELECT * FROM company_resource_revisions").all()).results,
    ).toEqual(original.results)
    expect(await repository.write(change)).toMatchObject({ kind: "applied", replayed: true })

    const shared = createCompanyD1TestDatabase(
      readFileSync(
        join(import.meta.dir, "../../src/contexts/company/infrastructure/schema/company.sql"),
        "utf8",
      ),
    )
    const triggers =
      "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'company_workforce_resource_%' ORDER BY name"
    const actual = (await database.prepare(triggers).all()).results
    expect(actual).toHaveLength(3)
    expect(actual).toEqual((await shared.prepare(triggers).all()).results)

    const failure = await database
      .prepare(`INSERT INTO company_resource_revisions
      (organization_id, resource_type, resource_id, revision, organization_revision, state, effective_from,
       effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
      VALUES ('organization:default', 'employee', 'employee:new', 1, 2, 'active', '2026-01-01',
        NULL, '{"personId":"person:missing"}', 'command:new', 'account:operator', '新しいデータ', 1)`)
      .run()
      .catch((cause: unknown) => cause)
    expect(failure).toBeInstanceOf(Error)
    if (!(failure instanceof Error)) throw new Error("expected reference failure")
    expect(failure.message).toContain("company_workforce_reference_not_found")
    expect(
      (await database.prepare("SELECT * FROM company_resource_revisions").all()).results,
    ).toEqual(original.results)
  })
})
