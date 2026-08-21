type DepartmentRow = {
  code: string
  name: string
  parent_code: string | null
  manager_employee_id: number | null
  manager_starts_on: string | null
  manager_ends_on: string | null
}

type EmployeeRow = {
  id: number
  period_id: string
  department_code: string
  position: string | null
  manager_employee_id: number | null
  starts_on: string
  ends_on: string | null
}

/** テストfixtureの現行雇用状態を、Company組織変更の不変条件を通して初期化する。 */
export async function initializeCanonicalCompanyOrganization(
  db: D1Database,
  baselineOn: string,
): Promise<void> {
  const departments = await db
    .prepare(
      `SELECT organization.code, department.name, organization.parent_code,
              manager.id AS manager_employee_id,
              responsibility.starts_on AS manager_starts_on,
              responsibility.ends_on AS manager_ends_on
       FROM org_departments AS organization
       JOIN departments AS department ON department.id = organization.department_id
       LEFT JOIN employees AS manager ON manager.code = organization.manager_employee_code
       LEFT JOIN employee_org_responsibility_period_versions AS responsibility
         ON responsibility.department_code = organization.code
        AND responsibility.employee_id = manager.id
        AND responsibility.responsibility_type = 'department_manager'
        AND responsibility.is_void = 0
        AND responsibility.revision = (
          SELECT max(candidate.revision)
          FROM employee_org_responsibility_period_versions AS candidate
          WHERE candidate.period_id = responsibility.period_id
        )
       ORDER BY organization.code`,
    )
    .all<DepartmentRow>()
  const employees = await db
    .prepare(
      `SELECT employee.id, employment.period_id,
              assignment.department_code, assignment.position_title AS position,
              assignment.manager_employee_id, assignment.starts_on, assignment.ends_on
       FROM employees AS employee
       JOIN employment_period_versions AS employment ON employment.employee_id = employee.id
       JOIN employee_org_assignment_period_versions AS assignment
         ON assignment.employment_period_id = employment.period_id
        AND assignment.employee_id = employee.id
        AND assignment.assignment_type = 'primary'
        AND assignment.is_void = 0
        AND assignment.starts_on <= ?1
        AND (assignment.ends_on IS NULL OR ?1 < assignment.ends_on)
        AND assignment.revision = (
          SELECT max(candidate.revision)
          FROM employee_org_assignment_period_versions AS candidate
          WHERE candidate.period_id = assignment.period_id
        )
       WHERE employee.status IN ('active', 'leave')
         AND employment.is_void = 0
         AND employment.starts_on <= ?1
         AND (employment.ends_on IS NULL OR ?1 < employment.ends_on)
         AND employment.revision = (
           SELECT max(candidate.revision)
           FROM employment_period_versions AS candidate
           WHERE candidate.period_id = employment.period_id
         )
       ORDER BY employee.id, employment.period_id`,
    )
    .bind(baselineOn)
    .all<EmployeeRow>()

  const uniqueEmployees = new Map<number, EmployeeRow>()
  for (const employee of employees.results) {
    if (uniqueEmployees.has(employee.id)) {
      throw new Error(`employee ${employee.id} has overlapping employment periods`)
    }
    uniqueEmployees.set(employee.id, employee)
  }

  const unitPeriods = new Set(
    (
      await db
        .prepare("SELECT period_id FROM organization_unit_period_versions")
        .all<{ period_id: string }>()
    ).results.map(({ period_id }) => period_id),
  )
  const assignmentPeriods = new Set(
    (
      await db
        .prepare("SELECT period_id FROM organization_assignment_period_versions")
        .all<{ period_id: string }>()
    ).results.map(({ period_id }) => period_id),
  )
  const responsibilityPeriods = new Set(
    (
      await db
        .prepare("SELECT period_id FROM organization_responsibility_period_versions")
        .all<{ period_id: string }>()
    ).results.map(({ period_id }) => period_id),
  )
  const missingDepartments = departments.results.filter(
    ({ code }) => unitPeriods.has(`department:${code}:initial`) === false,
  )
  const missingAssignments = [...uniqueEmployees.values()].filter(
    ({ id }) => assignmentPeriods.has(`employee:${id}:primary:initial`) === false,
  )
  const missingResponsibilities = departments.results.filter(
    ({ code, manager_employee_id }) =>
      manager_employee_id !== null &&
      uniqueEmployees.has(manager_employee_id) &&
      responsibilityPeriods.has(`department:${code}:manager:initial`) === false,
  )
  const changeCount =
    missingDepartments.length + missingAssignments.length + missingResponsibilities.length

  for (const department of departments.results) {
    await db
      .prepare("INSERT OR IGNORE INTO organization_units (id, created_at) VALUES (?1, 0)")
      .bind(`department:${department.code}`)
      .run()
  }

  if (changeCount === 0) return

  const expectedRevision =
    (await db
      .prepare("SELECT revision FROM organization_lifecycle_states WHERE id = 1")
      .first<number>("revision")) ?? 0
  const operationId = `initialization:test-organization:${expectedRevision}`
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO organization_change_operations
           (id, expected_revision, change_count, applied_count, resulting_revision, status,
            recorded_at, actor_account_id, reason)
         VALUES (?1, ?2, ?3, 0, ?4, 'PENDING', 0, 'system:test',
                 'Initialize Company test organization')`,
      )
      .bind(operationId, expectedRevision, changeCount, expectedRevision + changeCount),
  ]

  for (const department of missingDepartments) {
    statements.push(
      db
        .prepare(
          `INSERT INTO organization_unit_period_versions
             (period_id, revision, organization_unit_id, code, official_name, kind,
              parent_organization_unit_id, starts_on, ends_on, is_void,
              recorded_by_action_id, recorded_at)
           VALUES (?1, 1, ?2, ?3, ?4, 'DEPARTMENT', ?5, ?6, NULL, 0, ?7, 0)`,
        )
        .bind(
          `department:${department.code}:initial`,
          `department:${department.code}`,
          department.code,
          department.name,
          department.parent_code === null ? "company:root" : `department:${department.parent_code}`,
          baselineOn,
          operationId,
        ),
    )
  }

  for (const employee of missingAssignments) {
    statements.push(
      db
        .prepare(
          `INSERT INTO organization_assignment_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              assignment_type, position_title, manager_employee_id, starts_on, ends_on,
              is_void, recorded_by_action_id, recorded_at)
           VALUES (?1, 1, ?2, ?3, ?4, 'PRIMARY', ?5, ?6, ?7, ?8, 0, ?9, 0)`,
        )
        .bind(
          `employee:${employee.id}:primary:initial`,
          `employment:${employee.period_id}`,
          `employee:${employee.id}`,
          `department:${employee.department_code}`,
          employee.position,
          employee.manager_employee_id === null ? null : `employee:${employee.manager_employee_id}`,
          employee.starts_on,
          employee.ends_on,
          operationId,
        ),
    )
  }

  for (const department of missingResponsibilities) {
    const manager = uniqueEmployees.get(department.manager_employee_id!)!
    statements.push(
      db
        .prepare(
          `INSERT INTO organization_responsibility_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              responsibility_type, starts_on, ends_on, is_void,
              recorded_by_action_id, recorded_at)
           VALUES (?1, 1, ?2, ?3, ?4, 'MANAGER', ?5, ?6, 0, ?7, 0)`,
        )
        .bind(
          `department:${department.code}:manager:initial`,
          `employment:${manager.period_id}`,
          `employee:${manager.id}`,
          `department:${department.code}`,
          department.manager_starts_on ?? baselineOn,
          department.manager_ends_on,
          operationId,
        ),
    )
  }

  statements.push(
    db
      .prepare("UPDATE organization_change_operations SET status = 'COMPLETED' WHERE id = ?1")
      .bind(operationId),
  )
  await db.batch(statements)
}
