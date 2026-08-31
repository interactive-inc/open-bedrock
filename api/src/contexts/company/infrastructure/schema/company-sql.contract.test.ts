import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"

const companySql = readFileSync(new URL("./company.sql", import.meta.url), "utf8")

describe("canonical Company SQL", () => {
  test("resource revisionとcommand replayをDBでもfail closedにする", () => {
    const database = new Database(":memory:")
    database.exec("PRAGMA foreign_keys = ON")
    database.exec(companySql)
    database.exec(
      `INSERT INTO company_organizations (id, revision, created_at, updated_at)
       VALUES ('organization:1', 0, 1, 1)`,
    )

    expect(() =>
      database.exec(
        `INSERT INTO company_command_receipts
           (organization_id, command_id, fingerprint, expected_revision, organization_revision, recorded_at)
         VALUES ('organization:1', 'command:1', '${"a".repeat(64)}', 1, 2, 1)`,
      ),
    ).toThrow("company_revision_conflict")
  })

  test("SiteとWorkplaceの参照境界をDBでもfail closedにする", () => {
    const database = new Database(":memory:")
    database.exec("PRAGMA foreign_keys = ON")
    database.exec(companySql)
    database.exec(
      `INSERT INTO company_organizations (id, revision, created_at, updated_at)
       VALUES ('organization:1', 0, 1, 1)`,
    )

    expect(() =>
      database.exec(
        `INSERT INTO company_resource_revisions
           (organization_id, resource_type, resource_id, revision, organization_revision,
            state, effective_from, attributes_json, command_id, actor_account_id, reason, recorded_at)
         VALUES
           ('organization:1', 'site', 'site:1', 1, 1, 'active', '2026-01-01',
            '{"code":"MAIN","officialName":"Main","legalEntityId":"legal-entity:missing","kind":"physical","timeZone":"UTC","countryCode":"US"}',
            'command:1', 'account:1', 'create', 1)`,
      ),
    ).toThrow("company_site_legal_entity_not_found")

    expect(() =>
      database.exec(
        `INSERT INTO company_resource_revisions
           (organization_id, resource_type, resource_id, revision, organization_revision,
            state, effective_from, attributes_json, command_id, actor_account_id, reason, recorded_at)
         VALUES
           ('organization:1', 'workplace', 'workplace:1', 1, 1, 'active', '2026-01-01',
            '{"code":"OFFICE","officialName":"Office","siteId":"site:missing","kind":"office"}',
            'command:2', 'account:1', 'create', 1)`,
      ),
    ).toThrow("company_workplace_site_not_found")
  })

  test("職務・組織役職・責務・合議体の参照境界をDBでもfail closedにする", () => {
    const database = new Database(":memory:")
    database.exec("PRAGMA foreign_keys = ON")
    database.exec(companySql)
    database.exec(
      `INSERT INTO company_organizations (id, revision, created_at, updated_at)
       VALUES ('organization:1', 0, 1, 1)`,
    )

    expect(() =>
      database.exec(
        `INSERT INTO company_resource_revisions
           (organization_id, resource_type, resource_id, revision, organization_revision,
            state, effective_from, attributes_json, command_id, actor_account_id, reason, recorded_at)
         VALUES
           ('organization:1', 'organizational-office', 'office:1', 1, 1, 'active', '2026-01-01',
            '{"code":"OFFICE","officialName":"Office","organizationUnitId":"unit:missing","positionId":"position:missing"}',
            'command:office', 'account:1', 'create', 1)`,
      ),
    ).toThrow("company_organizational_office_reference_not_found")

    expect(() =>
      database.exec(
        `INSERT INTO company_resource_revisions
           (organization_id, resource_type, resource_id, revision, organization_revision,
            state, effective_from, attributes_json, command_id, actor_account_id, reason, recorded_at)
         VALUES
           ('organization:1', 'responsibility-assignment', 'assignment:1', 1, 1,
            'active', '2026-01-01',
            '{"responsibilityId":"responsibility:missing","holderType":"collective-body","holderId":"body:missing","authorityScopeId":null,"delegationAllowed":false}',
            'command:responsibility', 'account:1', 'create', 1)`,
      ),
    ).toThrow("company_responsibility_assignment_reference_not_found")

    expect(() =>
      database.exec(
        `INSERT INTO company_resource_revisions
           (organization_id, resource_type, resource_id, revision, organization_revision,
            state, effective_from, attributes_json, command_id, actor_account_id, reason, recorded_at)
         VALUES
           ('organization:1', 'collective-body-membership', 'membership:1', 1, 1,
            'active', '2026-01-01',
            '{"collectiveBodyId":"body:missing","employeeId":"employee:missing","role":"member","voting":true}',
            'command:membership', 'account:1', 'create', 1)`,
      ),
    ).toThrow("company_collective_body_membership_reference_not_found")
  })
})
