import { Database } from "bun:sqlite"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { verifyPassword } from "../src/contexts/system/lib/auth/verify-password"
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
  "company-public-workforce",
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
const assignmentEligibleEmploymentCount = (
  db
    .query("SELECT COUNT(*) AS count FROM company_employments WHERE status != 'TERMINATED'")
    .get() as { count: number }
).count
const accountLinkCount = (
  db.query("SELECT COUNT(*) AS count FROM company_account_employee_links").get() as {
    count: number
  }
).count
const publicWorkforceGapCount = (
  db
    .query(`SELECT count(*) AS count FROM company_employees employee
    JOIN company_employments employment ON employment.employee_id = employee.id
    WHERE NOT EXISTS (
      SELECT 1 FROM company_workforce_resource_bindings binding
      JOIN company_resource_heads head ON head.organization_id = binding.organization_id
        AND head.resource_type = binding.resource_type AND head.resource_id = binding.resource_id
      WHERE binding.resource_type = 'employee' AND binding.employee_id = employee.id
        AND head.state = 'active'
        AND json_extract(head.attributes_json, '$.employeeCode') IS employee.employee_code
        AND json_extract(head.attributes_json, '$.personId') = 'person:seed:' || employee.id
    ) OR NOT EXISTS (
      SELECT 1 FROM company_resource_heads person
      WHERE person.resource_type = 'person' AND person.resource_id = 'person:seed:' || employee.id
        AND person.state = 'active'
        AND json_extract(person.attributes_json, '$.officialName') = employee.official_name
        AND json_extract(person.attributes_json, '$.email') IS employee.email
    ) OR NOT EXISTS (
      SELECT 1 FROM company_workforce_resource_bindings binding
      JOIN company_resource_heads head ON head.organization_id = binding.organization_id
        AND head.resource_type = binding.resource_type AND head.resource_id = binding.resource_id
      WHERE binding.resource_type = 'employment' AND binding.resource_id = employment.id
        AND binding.employee_id = employee.id AND head.state = 'active'
        AND json_extract(head.attributes_json, '$.employeeId') = employee.id
        AND json_extract(head.attributes_json, '$.status') = employment.status
        AND json_extract(head.attributes_json, '$.employmentType') = employment.employment_type
    )`)
    .get() as { count: number }
).count
const publicAccountLinkGapCount = (
  db
    .query(`SELECT count(*) AS count FROM company_account_employee_links legacy
    WHERE NOT EXISTS (
      SELECT 1 FROM company_account_employee_resource_bindings binding
      JOIN company_resource_heads head ON head.organization_id = binding.organization_id
        AND head.resource_type = 'account-employee-link' AND head.resource_id = binding.resource_id
      WHERE binding.account_id = legacy.account_id AND binding.employee_id = legacy.employee_id
        AND head.state = 'active'
        AND json_extract(head.attributes_json, '$.accountId') = legacy.account_id
        AND json_extract(head.attributes_json, '$.employeeId') = legacy.employee_id
    )`)
    .get() as { count: number }
).count
const publicEffectiveAccountLinkCount = (
  db
    .query(`SELECT count(*) AS count FROM company_account_employee_link_periods
    WHERE source = 'public' AND starts_on <= '2026-01-01'
      AND (ends_on IS NULL OR '2026-01-01' < ends_on)`)
    .get() as { count: number }
).count
const retiredEmployeeHistory = db
  .query(`SELECT revision, effective_from, status FROM (
  SELECT revision, effective_from,
    json_extract(attributes_json, '$.status') AS status
  FROM company_resource_revisions
  WHERE resource_type = 'employment' AND resource_id = 'employment:seed-employment-18'
  ORDER BY revision
)`)
  .all() as Array<{ revision: number; effective_from: string; status: string }>
const localSeedCredential = db
  .query(
    `SELECT credential.password_hash AS passwordHash
     FROM system_identity_bindings identity
     INNER JOIN system_password_credentials credential ON credential.identity_id = identity.id
     WHERE identity.provider = 'password' AND identity.subject = 'you+e001@example.com'`,
  )
  .get() as { passwordHash: string } | null
const localSeedCredentialValid =
  localSeedCredential !== null &&
  (await verifyPassword(
    "password",
    localSeedCredential.passwordHash,
    "open-bedrock-local-seed-pepper",
  ))

if (
  baselineCount !== employeeCount ||
  employmentCount !== employeeCount ||
  lifecycleEmploymentCount !== employeeCount ||
  statusCount !== employmentCount ||
  accountLinkCount > employeeCount ||
  publicWorkforceGapCount !== 0 ||
  publicAccountLinkGapCount !== 0 ||
  publicEffectiveAccountLinkCount !== accountLinkCount ||
  JSON.stringify(retiredEmployeeHistory) !==
    JSON.stringify([
      { revision: 1, effective_from: "2025-01-01", status: "ACTIVE" },
      { revision: 2, effective_from: "2025-12-31", status: "TERMINATED" },
    ]) ||
  !localSeedCredentialValid
) {
  throw new Error(
    `employee lifecycle or local login seed is incomplete: publicWorkforceGaps=${publicWorkforceGapCount}, publicAccountLinkGaps=${publicAccountLinkGapCount}, effectivePublicAccountLinks=${publicEffectiveAccountLinkCount}/${accountLinkCount}, retiredHistory=${JSON.stringify(retiredEmployeeHistory)}`,
  )
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
  organizationAssignmentCount !== assignmentEligibleEmploymentCount ||
  managerResponsibilityCount !== 6 ||
  peopleOperationsCount !== 1 ||
  orphanedWorkforceRows !== 0 ||
  retiredCompanyTables.length !== 0 ||
  foreignKeyViolations.length !== 0
) {
  throw new Error(
    `Company organization seed is incomplete: pending=${pendingOrganizationChanges}, ` +
      `revision=${organizationRevision}/27, units=${organizationUnitCount}/7, ` +
      `assignments=${organizationAssignmentCount}/${assignmentEligibleEmploymentCount}, ` +
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
