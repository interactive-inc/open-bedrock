import { afterEach, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { drizzle } from "drizzle-orm/d1"
import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { wrapSystemD1TestDatabase } from "@system/test/wrap-system-d1-test-database.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const databases: Database[] = []
afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

test("千人を超える会社のAccountを問い合わせ上限内で読み、停止中の対応を除外する", async () => {
  const sqlite = new Database(":memory:")
  databases.push(sqlite)
  sqlite.exec("PRAGMA foreign_keys = ON")
  sqlite.exec(
    readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
      .join("\n"),
  )
  let reading = false
  let queries = 0
  const database = wrapSystemD1TestDatabase(sqlite, {
    onQuery: () => {
      if (reading && ++queries > 50) throw new Error("D1 request query limit exceeded")
    },
  })
  const people = Array.from({ length: 1001 }, (_, index) => ({
    accountId: `account:workforce-${index}`,
    employeeId: `employee:workforce-${index}`,
    status: index === 0 ? "locked" : index === 1 ? "suspended" : "active",
  }))
  const input = JSON.stringify(people)
  await database.batch([
    database
      .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      SELECT json_extract(value, '$.accountId'), json_extract(value, '$.status'), 0, 0, 0 FROM json_each(?1)`)
      .bind(input),
    database
      .prepare(`INSERT INTO company_employees (id, official_name, created_at, updated_at)
      SELECT json_extract(value, '$.employeeId'), 'Member', 0, 0 FROM json_each(?1)`)
      .bind(input),
    database
      .prepare(`INSERT INTO company_account_employee_links (account_id, employee_id)
      SELECT json_extract(value, '$.accountId'), json_extract(value, '$.employeeId') FROM json_each(?1)`)
      .bind(input),
    database.prepare(`INSERT OR IGNORE INTO company_organizations
      (id, revision, name, representative_name, created_at, updated_at)
      VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 1, 'Example', '', 0, 0)`),
    database
      .prepare(`INSERT INTO company_resource_revisions
        (organization_id, resource_type, resource_id, revision, organization_revision,
         state, effective_from, attributes_json, command_id, actor_account_id, reason, recorded_at)
      SELECT '${COMPANY_DEFAULT_ORGANIZATION_ID}', 'person', 'person:' || json_extract(value, '$.employeeId'),
        1, 1, 'active', '2020-01-01', json_object('officialName', 'Member'),
        'test:workforce-people', 'system:test', 'Confirmed test person', 0
      FROM json_each(?1)`)
      .bind(input),
    database.prepare(`INSERT INTO company_resource_heads
      (organization_id, resource_type, resource_id, revision, organization_revision,
       state, effective_from, effective_to, attributes_json, updated_at)
      SELECT organization_id, resource_type, resource_id, revision, organization_revision,
        state, effective_from, effective_to, attributes_json, recorded_at
      FROM company_resource_revisions WHERE command_id = 'test:workforce-people'`),
    database
      .prepare(`INSERT INTO company_resource_revisions
        (organization_id, resource_type, resource_id, revision, organization_revision,
         state, effective_from, attributes_json, command_id, actor_account_id, reason, recorded_at)
      SELECT '${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee', json_extract(value, '$.employeeId'),
        1, 1, 'active', '2020-01-01',
        json_object('personId', 'person:' || json_extract(value, '$.employeeId')),
        'test:workforce-employees', 'system:test', 'Confirmed test employee', 0
      FROM json_each(?1)`)
      .bind(input),
    database.prepare(`INSERT INTO company_resource_heads
      (organization_id, resource_type, resource_id, revision, organization_revision,
       state, effective_from, effective_to, attributes_json, updated_at)
      SELECT organization_id, resource_type, resource_id, revision, organization_revision,
        state, effective_from, effective_to, attributes_json, recorded_at
      FROM company_resource_revisions WHERE command_id = 'test:workforce-employees'`),
    database
      .prepare(`INSERT INTO company_workforce_resource_bindings
        (resource_type, resource_id, organization_id, employee_id, resource_revision, lifecycle_revision)
      SELECT 'employee', json_extract(value, '$.employeeId'), '${COMPANY_DEFAULT_ORGANIZATION_ID}',
        json_extract(value, '$.employeeId'), 1, 0 FROM json_each(?1)`)
      .bind(input),
    database
      .prepare(`INSERT INTO company_resource_revisions
        (organization_id, resource_type, resource_id, revision, organization_revision,
         state, effective_from, attributes_json, command_id, actor_account_id, reason, recorded_at)
      SELECT '${COMPANY_DEFAULT_ORGANIZATION_ID}', 'account-employee-link', 'link:' || json_extract(value, '$.accountId'),
        1, 1, 'active', '2020-01-01',
        json_object('accountId', json_extract(value, '$.accountId'),
          'employeeId', json_extract(value, '$.employeeId')),
        'test:workforce-account-batch', 'system:test', 'Confirmed test correspondence', 0
      FROM json_each(?1)`)
      .bind(input),
    database.prepare(`INSERT INTO company_resource_heads
      (organization_id, resource_type, resource_id, revision, organization_revision,
       state, effective_from, effective_to, attributes_json, updated_at)
      SELECT organization_id, resource_type, resource_id, revision, organization_revision,
        state, effective_from, effective_to, attributes_json, recorded_at
      FROM company_resource_revisions WHERE command_id = 'test:workforce-account-batch'`),
    database.prepare(`INSERT INTO company_account_employee_resource_bindings
      (resource_id, organization_id, account_id, employee_id, recorded_at)
      SELECT resource_id, organization_id,
        json_extract(attributes_json, '$.accountId'), json_extract(attributes_json, '$.employeeId'), 0
      FROM company_resource_heads WHERE resource_type = 'account-employee-link'`),
  ])
  reading = true
  const result = await new OrganizationWorkforceSnapshotAdapter({
    env: { DB: database, COMPANY_TIME_ZONE: "UTC", NOW: "2030-01-01T00:00:00.000Z" },
    var: {
      database: drizzle(database),
      auditContext: {
        requestId: "workforce-account-batch",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      },
    },
  }).readAllSnapshot(restoreCalendarDate("2030-01-01"))
  expect(result.ok).toBe(true)
  if (!result.ok) throw result.cause
  expect(result.schedules).toHaveLength(1001)
  expect(result.schedules.filter((schedule) => schedule.accountLink !== null)).toHaveLength(999)
  expect(
    result.schedules
      .filter((schedule) => schedule.accountLink === null)
      .map((schedule) => String(schedule.employee.id))
      .sort((left, right) => left.localeCompare(right)),
  ).toEqual(["employee:workforce-0", "employee:workforce-1"])
  expect(queries).toBeLessThanOrEqual(20)
})
