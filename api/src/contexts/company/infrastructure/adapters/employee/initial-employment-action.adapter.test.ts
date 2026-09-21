import { expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { drizzle } from "drizzle-orm/d1"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { InitialEmploymentActionAdapter } from "@/contexts/company/infrastructure/adapters/employee/initial-employment-action.adapter"
import { InitialEmploymentPersistenceAdapter } from "@/contexts/company/infrastructure/adapters/employee/initial-employment-persistence.adapter"
import {
  InitialWorkforceResourceJournalAdapter,
  type InitialWorkforceResource,
} from "@/contexts/company/infrastructure/adapters/employee/initial-workforce-resource-journal.adapter"
import { PublishedInitialWorkforceAdapter } from "@/contexts/company/infrastructure/adapters/employee/published-initial-workforce.adapter"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
const item: InitialWorkforceResource = {
  employeeId: restoreWorkforceId("employee", "employee:one"),
  employmentId: restoreWorkforceId("employment", "employment:one"),
  officialName: "Example Person",
  employeeCode: "one",
  email: "you@example.com",
  phone: null,
  employmentType: "PART_TIME",
  status: "leave",
  effectiveOn: restoreCalendarDate("2026-09-01"),
  occurredAt: new Date("2026-08-01T00:00:00Z"),
  actorAccountId: "account:operator",
  operationId: "initial:one",
  reason: "Confirmed new employment",
  lifecycleRevision: 0,
}

async function rows(database: D1Database) {
  const read = async (sql: string) => (await database.prepare(sql).all()).results
  return {
    employees: await read(
      "SELECT id, official_name, employee_code, email, phone FROM company_employees",
    ),
    employments: await read(
      "SELECT id, employee_id, contract_name, employment_type, hire_date, status, termination_date FROM company_employments",
    ),
    periods: await read(
      "SELECT period_id, revision, starts_on, ends_on, is_void, recorded_by_action_id FROM company_employment_period_versions",
    ),
    statuses: await read(
      "SELECT revision, status, starts_on, ends_on, is_void, recorded_by_action_id FROM company_employee_status_period_versions",
    ),
    actions: await read("SELECT * FROM company_personnel_actions"),
    lifecycle: await read("SELECT employee_id, revision FROM company_employee_lifecycle_revisions"),
    bindings: await read(
      "SELECT resource_type, resource_id, resource_revision, lifecycle_revision, last_action_id FROM company_workforce_resource_bindings ORDER BY resource_type",
    ),
    resources: await read(
      "SELECT resource_type, resource_id, revision, state, effective_from, attributes_json FROM company_resource_revisions ORDER BY resource_type",
    ),
    organization: await read("SELECT revision FROM company_organizations"),
  }
}

/** 表を先に書き、公開 resource をその行と照合して派生させる、置き換え前の経路。 */
async function tableFirst() {
  const database = createCompanyD1TestDatabase(schemaSql)
  const context = { env: { DB: database }, var: { database: drizzle(database) } }
  const lifecycle = await new InitialEmploymentPersistenceAdapter(context).prepare(item)
  const journal = await new InitialWorkforceResourceJournalAdapter(context).prepare(item)
  if (lifecycle instanceof Error || journal instanceof Error) throw new Error("setup failed")
  await database.batch([
    database
      .prepare(`INSERT INTO company_employees
      (id, official_name, employee_code, email, phone, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`)
      .bind(
        item.employeeId,
        item.officialName,
        item.employeeCode,
        item.email,
        item.phone,
        item.occurredAt.getTime(),
      ),
    database
      .prepare(`INSERT INTO company_employments
      (id, employee_id, contract_name, employment_type, hire_date, status, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, 'ON_LEAVE', ?6, ?6)`)
      .bind(
        item.employmentId,
        item.employeeId,
        item.officialName,
        item.employmentType,
        item.effectiveOn,
        item.occurredAt.getTime(),
      ),
    ...lifecycle,
    ...journal,
  ])
  return rows(database)
}

async function published() {
  const database = createCompanyD1TestDatabase(schemaSql)
  const action = await new InitialEmploymentActionAdapter(database).prepare(item)
  if (action instanceof Error) throw action
  const workforce = await new PublishedInitialWorkforceAdapter(database).prepare({
    ...item,
    commandId: `initial-workforce:${item.operationId}`,
    recordedAt: item.occurredAt.getTime(),
    expectedOrganizationRevision: 0,
    actionId: action.actionId,
    businessDate: "2026-08-01",
    lifecycleRevision: 0,
  })
  if (workforce instanceof Error) throw workforce
  await database.batch([
    ...workforce.identityStatements,
    ...action.statements,
    ...workforce.employmentStatements,
    ...workforce.commitStatements,
  ])
  return { database, rows: await rows(database) }
}

test("公開 resource を先に書く初回雇用は、表を先に書く経路と同じ行を書く", async () => {
  const before = await tableFirst()
  const after = (await published()).rows

  expect(after).toEqual(before)
  // 全 migration を適用した DB を 2 つ作るので、既定の 5 秒では足りない製品がある。
}, 30_000)

test("同じ従業員の 2 回目の初回雇用は、発令を重ねず全体を中断する", async () => {
  const { database, rows: first } = await published()
  const action = await new InitialEmploymentActionAdapter(database).prepare(item)
  if (action instanceof Error) throw action

  await expect(database.batch([...action.statements])).rejects.toThrow()
  expect(await rows(database)).toEqual(first)
}, 30_000)
