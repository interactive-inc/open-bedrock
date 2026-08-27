import { Database } from "bun:sqlite"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { executeSql } from "./sql-statements"

const root = join(import.meta.dir, "..")

const migrationsDir = join(root, "migrations")

const seedsDir = join(root, "seeds")

/** 安全ガード: 想定外に巨大なファイルがあれば中断（自己参照膨張の再発防止）。 */
function assertSane(path: string): void {
  const size = statSync(path).size

  if (size > 1_000_000) {
    throw new Error(`${path} is ${size} bytes — too large, aborting`)
  }
}

const db = new Database(":memory:")
db.run("PRAGMA foreign_keys = ON")

/** migrations を結合して適用（個々の空ファイル対策）。 */
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()

for (const file of migrationFiles) {
  const path = join(migrationsDir, file)
  assertSane(path)
  executeSql(db, readFileSync(path, "utf8"), `migration ${file}`)
}

/** seeds を依存順（employee → org → 残り）に 1 ファイルずつ適用。 */
const order = [
  "employee",
  "org",
  "iam",
  "employee-lifecycle",
  "application",
  "approval-delegation",
  "personnel-action",
  "position",
  "grade",
  "company",
]

const seedFiles = readdirSync(seedsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()

const ordered = [
  ...order.map((domain) => `${domain}.sql`),
  ...seedFiles.filter((file) => order.includes(file.replace(".sql", "")) === false),
]

for (const file of ordered) {
  const path = join(seedsDir, file)

  assertSane(path)

  const sql = readFileSync(path, "utf8")

  if (sql.includes("INSERT INTO") === false) {
    continue
  }

  executeSql(db, sql, `seed ${file}`)
}

const employeeCount = (
  db.query("SELECT COUNT(*) AS count FROM company_employees").get() as {
    count: number
  }
).count
const baselineCount = (
  db
    .query("SELECT COUNT(*) AS count FROM company_personnel_actions WHERE kind = 'initial_state'")
    .get() as { count: number }
).count
const employmentCount = (
  db.query("SELECT COUNT(*) AS count FROM company_employments").get() as { count: number }
).count
const lifecycleEmploymentCount = (
  db.query("SELECT COUNT(*) AS count FROM company_employment_period_versions").get() as {
    count: number
  }
).count
const statusCount = (
  db.query("SELECT COUNT(*) AS count FROM company_employee_status_period_versions").get() as {
    count: number
  }
).count
const statusEligibleEmploymentCount = (
  db
    .query("SELECT COUNT(*) AS count FROM company_employments WHERE status != 'TERMINATED'")
    .get() as { count: number }
).count
const accountLinkCount = (
  db.query("SELECT COUNT(*) AS count FROM company_account_employee_links").get() as {
    count: number
  }
).count

if (
  baselineCount !== employeeCount ||
  employmentCount !== employeeCount ||
  lifecycleEmploymentCount !== employeeCount ||
  statusCount !== statusEligibleEmploymentCount ||
  accountLinkCount > employeeCount
) {
  throw new Error("employee lifecycle seed is incomplete")
}

const pendingOrganizationChanges = (
  db
    .query(
      "SELECT count(*) AS count FROM company_organization_change_operations WHERE status != 'COMPLETED'",
    )
    .get() as { count: number }
).count
const organizationRevision = (
  db.query("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1").get() as {
    revision: number
  }
).revision
const organizationUnitCount = (
  db.query("SELECT count(*) AS count FROM company_organization_unit_period_versions").get() as {
    count: number
  }
).count
const organizationAssignmentCount = (
  db
    .query("SELECT count(*) AS count FROM company_organization_assignment_period_versions")
    .get() as {
    count: number
  }
).count
const managerResponsibilityCount = (
  db
    .query(
      "SELECT count(*) AS count FROM company_organization_responsibility_period_versions WHERE responsibility_type = 'MANAGER'",
    )
    .get() as { count: number }
).count
const peopleOperationsCount = (
  db
    .query(
      "SELECT count(*) AS count FROM company_organization_responsibility_period_versions WHERE responsibility_type = 'PEOPLE_OPERATIONS'",
    )
    .get() as { count: number }
).count
const orphanedWorkforceRows = (
  db
    .query(
      `SELECT
         (SELECT count(*)
          FROM company_employment_period_versions period
          LEFT JOIN company_employments employment
            ON employment.id = period.period_id
           AND employment.employee_id = period.employee_id
          WHERE employment.id IS NULL)
       + (SELECT count(*)
          FROM company_employee_status_period_versions status
          LEFT JOIN company_employments employment
            ON employment.id = status.employment_period_id
           AND employment.employee_id = status.employee_id
          WHERE employment.id IS NULL)
       + (SELECT count(*)
          FROM company_organization_assignment_period_versions assignment
          LEFT JOIN company_employments employment
            ON employment.id = assignment.employment_id
           AND employment.employee_id = assignment.employee_id
          WHERE employment.id IS NULL)
       + (SELECT count(*)
          FROM company_organization_responsibility_period_versions responsibility
          LEFT JOIN company_employments employment
            ON employment.id = responsibility.employment_id
           AND employment.employee_id = responsibility.employee_id
          WHERE employment.id IS NULL) AS count`,
    )
    .get() as { count: number }
).count
const foreignKeyViolations = db.query("PRAGMA foreign_key_check").all()
const retiredCompanyTables = (
  db
    .query(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name IN (
         'employees', 'account_employee_links', 'company_departments',
         'company_org_departments', 'company_org_memberships',
         'company_employee_org_assignment_period_versions',
         'company_employee_org_responsibility_period_versions'
       )`,
    )
    .all() as Array<{ name: string }>
).map((row) => row.name)

if (
  pendingOrganizationChanges !== 0 ||
  organizationRevision !== 27 ||
  organizationUnitCount !== 7 ||
  organizationAssignmentCount !== statusEligibleEmploymentCount ||
  managerResponsibilityCount !== 6 ||
  peopleOperationsCount !== 1 ||
  orphanedWorkforceRows !== 0 ||
  retiredCompanyTables.length !== 0 ||
  foreignKeyViolations.length !== 0
) {
  throw new Error(
    `Company organization seed is incomplete: pending=${pendingOrganizationChanges}, ` +
      `revision=${organizationRevision}/27, units=${organizationUnitCount}/7, ` +
      `assignments=${organizationAssignmentCount}/${statusEligibleEmploymentCount}, ` +
      `managers=${managerResponsibilityCount}/6, ` +
      `peopleOperations=${peopleOperationsCount}/1, ` +
      `orphanedWorkforce=${orphanedWorkforceRows}, ` +
      `retiredTables=${JSON.stringify(retiredCompanyTables)}, ` +
      `foreignKeys=${JSON.stringify(foreignKeyViolations)}`,
  )
}

const tables = (
  db
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as Array<{
    name: string
  }>
).map((row) => row.name)

let total = 0

for (const table of tables.sort()) {
  const result = db.query(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }

  total += result.count

  console.log(`${table} = ${result.count}`)
}

console.log(`\n${tables.length} tables, ${total} seeded rows — SEED OK`)
