import { Database } from "bun:sqlite"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

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

/** migrations を結合して適用（個々の空ファイル対策）。 */
const schema = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => {
    const path = join(migrationsDir, file)

    assertSane(path)

    return readFileSync(path, "utf8")
  })
  .join("\n")

db.exec(schema)

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

  db.exec(sql)
}

const employeeCount = (
  db.query("SELECT COUNT(*) AS count FROM employees").get() as {
    count: number
  }
).count
const baselineCount = (
  db
    .query("SELECT COUNT(*) AS count FROM personnel_actions WHERE kind = 'initial_state'")
    .get() as { count: number }
).count

if (baselineCount !== employeeCount) {
  throw new Error("employee lifecycle seed is incomplete")
}

const companyOrganization = db
  .query("SELECT revision FROM company_organizations WHERE id = 'organization:default'")
  .get() as { revision: number } | null
const companyHeadCount = (
  db.query("SELECT COUNT(*) AS count FROM company_resource_heads").get() as { count: number }
).count
const companyRevisionCount = (
  db.query("SELECT COUNT(*) AS count FROM company_resource_revisions").get() as { count: number }
).count

if (
  companyOrganization?.revision !== 1 ||
  companyHeadCount < employeeCount * 3 ||
  companyRevisionCount !== companyHeadCount
) {
  throw new Error(
    `canonical Company seed is incomplete: organizationRevision=${companyOrganization?.revision ?? "missing"}, ` +
      `heads=${companyHeadCount}, revisions=${companyRevisionCount}, employees=${employeeCount}`,
  )
}

const pendingOrganizationChanges = (
  db
    .query(
      "SELECT count(*) AS count FROM organization_change_operations WHERE status != 'COMPLETED'",
    )
    .get() as { count: number }
).count
const organizationUnitCount = (
  db.query("SELECT count(*) AS count FROM organization_unit_period_versions").get() as {
    count: number
  }
).count
const departmentCount = (
  db.query("SELECT count(*) AS count FROM org_departments").get() as { count: number }
).count
const organizationAssignmentCount = (
  db.query("SELECT count(*) AS count FROM organization_assignment_period_versions").get() as {
    count: number
  }
).count
const employedEmployeeCount = (
  db.query("SELECT count(*) AS count FROM employees WHERE status IN ('active', 'leave')").get() as {
    count: number
  }
).count
const managerResponsibilityCount = (
  db
    .query(
      "SELECT count(*) AS count FROM organization_responsibility_period_versions WHERE responsibility_type = 'MANAGER'",
    )
    .get() as { count: number }
).count
const expectedManagerResponsibilityCount = (
  db
    .query(
      `SELECT count(*) AS count
       FROM org_departments AS organization
       JOIN employees AS manager ON manager.code = organization.manager_employee_code
       WHERE manager.status IN ('active', 'leave')`,
    )
    .get() as { count: number }
).count
const peopleOperationsCount = (
  db
    .query(
      "SELECT count(*) AS count FROM organization_responsibility_period_versions WHERE responsibility_type = 'PEOPLE_OPERATIONS'",
    )
    .get() as { count: number }
).count
const foreignKeyViolations = db.query("PRAGMA foreign_key_check").all()

if (
  pendingOrganizationChanges !== 0 ||
  organizationUnitCount !== departmentCount + 1 ||
  organizationAssignmentCount !== employedEmployeeCount ||
  managerResponsibilityCount !== expectedManagerResponsibilityCount ||
  peopleOperationsCount !== 1 ||
  foreignKeyViolations.length !== 0
) {
  throw new Error(
    `Company organization seed is incomplete: pending=${pendingOrganizationChanges}, ` +
      `units=${organizationUnitCount}/${departmentCount + 1}, ` +
      `assignments=${organizationAssignmentCount}/${employedEmployeeCount}, ` +
      `managers=${managerResponsibilityCount}/${expectedManagerResponsibilityCount}, ` +
      `peopleOperations=${peopleOperationsCount}/1, ` +
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
