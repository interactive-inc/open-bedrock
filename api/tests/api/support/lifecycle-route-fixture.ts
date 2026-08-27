import { seedDepartments } from "@tests/api/support/company/seed-departments.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedOrgDepartments } from "@tests/api/support/company/seed-org-departments.test-support"
import { seedOrgMemberships } from "@tests/api/support/company/seed-org-memberships.test-support"
import { seedPositions } from "@tests/api/support/company/seed-positions.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { initializeCompanyTestFixture } from "@tests/api/support/initialize-company-test-fixture"
import { loadSchema } from "@tests/api/support/load-schema"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"

export const lifecycleRouteJwtSecret = "lifecycle-route-test-secret"

export async function readOrganizationRevision(db: D1Database): Promise<number> {
  const revision = await db
    .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
    .first<number>("revision")
  if (revision === null) throw new Error("organization lifecycle revision is missing")
  return revision
}

/**
 * テスト用の共通 fixture DB を作る。
 * onQuery を渡すと、発行された全クエリを数えられる（N+1 の検出に使う）。
 */
export async function createLifecycleRouteDb(
  options?: Readonly<{
    onQuery?: () => void
    subjectAssignmentStartsOn?: string
    subjectAssignmentEndsOn?: string | null
    managerEndsOn?: string
  }>,
): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema(), options)
  await initializeCompanyTestFixture({
    db,
    employees: seedEmployees,
    departments: seedOrgDepartments.map((organization) => ({
      id: organization.departmentId,
      code: organization.code,
      name:
        seedDepartments.find((department) => department.id === organization.departmentId)?.name ??
        organization.code,
      parentCode: organization.parentCode,
      managerEmployeeCode: organization.managerEmployeeCode,
    })),
    memberships: seedOrgMemberships,
  })
  await seedD1(
    db,
    "company_position_definitions",
    seedPositions.map((position) => ({
      id: position.id,
      code: position.code,
      name: position.name,
      rank: position.rank,
      description: position.description,
      created_at: position.createdAt,
    })),
  )
  await seedIamForEmployees(db)
  const expectedRevision = await readOrganizationRevision(db)
  const operationId = `test:lifecycle-route:${expectedRevision}`
  const organizationStatements: D1PreparedStatement[] = []
  if (
    options?.subjectAssignmentStartsOn !== undefined ||
    options?.subjectAssignmentEndsOn !== undefined
  ) {
    organizationStatements.push(
      db
        .prepare(
          `INSERT INTO company_organization_assignment_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              assignment_type, position_title, manager_employee_id, starts_on, ends_on,
              is_void, recorded_by_action_id, recorded_at)
           VALUES ('test:assignment:5:primary:D003', 2, 'test:5:employment', '5',
                   'department:D003', 'PRIMARY', 'シニアエンジニア', '4', ?1, ?2, 0, ?3, 2)`,
        )
        .bind(
          options.subjectAssignmentStartsOn ?? "2025-01-01",
          options.subjectAssignmentEndsOn ?? null,
          operationId,
        ),
    )
  }
  if (options?.managerEndsOn !== undefined) {
    organizationStatements.push(
      db
        .prepare(
          `INSERT INTO company_organization_responsibility_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              responsibility_type, starts_on, ends_on, is_void,
              recorded_by_action_id, recorded_at)
           VALUES ('test:responsibility:4:manager:D003', 2, 'test:4:employment', '4',
                   'department:D003', 'MANAGER', '2025-01-01', ?1, 0, ?2, 2)`,
        )
        .bind(options.managerEndsOn, operationId),
      db
        .prepare(
          `INSERT INTO company_organization_assignment_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              assignment_type, position_title, manager_employee_id, starts_on, ends_on,
              is_void, recorded_by_action_id, recorded_at)
           VALUES ('test:assignment:4:primary:D003', 2, 'test:4:employment', '4',
                   'department:D003', 'PRIMARY', '開発マネージャー', '1',
                   '2025-01-01', ?1, 0, ?2, 2)`,
        )
        .bind(options.managerEndsOn, operationId),
      db
        .prepare(
          `INSERT INTO company_organization_assignment_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              assignment_type, position_title, manager_employee_id, starts_on, ends_on,
              is_void, recorded_by_action_id, recorded_at)
           VALUES ('test:assignment:5:primary:D003', 2, 'test:5:employment', '5',
                   'department:D003', 'PRIMARY', 'シニアエンジニア', '4',
                   '2025-01-01', ?1, 0, ?2, 2)`,
        )
        .bind(options.managerEndsOn, operationId),
    )
  }
  if (organizationStatements.length > 0) {
    const statements = [
      db
        .prepare(
          `INSERT INTO company_organization_change_operations
             (id, expected_revision, change_count, applied_count, resulting_revision, status,
              recorded_at, request_fingerprint, actor_account_id, reason,
              evidence_references_json)
           VALUES (?1, ?2, ?3, 0, ?4, 'PENDING', 2,
                   '0000000000000000000000000000000000000000000000000000000000000000',
                   'system:test', 'Adjust lifecycle route fixture', '[]')`,
        )
        .bind(
          operationId,
          expectedRevision,
          organizationStatements.length,
          expectedRevision + organizationStatements.length,
        ),
      ...organizationStatements,
      db
        .prepare(
          "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = ?1",
        )
        .bind(operationId),
    ]
    await db.batch(statements)
  }
  if (options?.managerEndsOn !== undefined) {
    await db.batch([
      db
        .prepare(
          `INSERT INTO company_employee_status_period_versions
             (period_id, revision, employment_period_id, employee_id, status, starts_on,
              ends_on, is_void, recorded_by_action_id, recorded_at)
           VALUES ('test:4:status', 2, 'test:4:employment', '4', 'active', '2025-01-01',
                   ?1, 0, 'test:4:initial-state', 2)`,
        )
        .bind(options.managerEndsOn),
      db
        .prepare(
          `INSERT INTO company_employment_period_versions
             (period_id, revision, employee_id, starts_on, ends_on, is_void,
              recorded_by_action_id, recorded_at)
           VALUES ('test:4:employment', 2, '4', '2025-01-01', ?1, 0,
                   'test:4:initial-state', 2)`,
        )
        .bind(options.managerEndsOn),
    ])
  }

  return db
}
