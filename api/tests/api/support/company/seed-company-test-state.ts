export type CompanyEmployeeFixture = Readonly<{
  id: number | string
  code?: string | null
  name: string
  email?: string | null
  deptId?: number | null
  deptName?: string | null
  position?: string | null
  status?: "active" | "leave" | "retired"
}>

export type CompanyDepartmentFixture = Readonly<{
  id: number
  code: string
  name: string
  parentCode?: string | null
  managerEmployeeCode?: string | null
}>

export type CompanyMembershipFixture = Readonly<{
  departmentCode: string
  employeeCode: string
  managerEmployeeCode?: string | null
}>

const baselineOn = "2025-01-01"
const recordedAt = Date.parse(`${baselineOn}T00:00:00.000Z`)
const fingerprint = "0".repeat(64)

function employeeId(employee: CompanyEmployeeFixture): string {
  return String(employee.id)
}

function employmentId(employee: CompanyEmployeeFixture): string {
  return `test:${employeeId(employee)}:employment`
}

function personnelActionId(employee: CompanyEmployeeFixture): string {
  return `test:${employeeId(employee)}:initial-state`
}

function departmentFor(
  employee: CompanyEmployeeFixture,
  departments: ReadonlyArray<CompanyDepartmentFixture>,
): CompanyDepartmentFixture | null {
  const departmentId = employee.deptId
  if (departmentId === undefined || departmentId === null) return null
  return departments.find((department) => department.id === departmentId) ?? null
}

function managerCodeFor(
  employee: CompanyEmployeeFixture,
  departmentCode: string,
  memberships: ReadonlyArray<CompanyMembershipFixture>,
): string | null {
  if (employee.code === undefined || employee.code === null) return null
  return (
    memberships.find(
      (membership) =>
        membership.employeeCode === employee.code && membership.departmentCode === departmentCode,
    )?.managerEmployeeCode ?? null
  )
}

/** 現行Company台帳へEmployee・Employment・初期ライフサイクルを直接投入する。 */
export async function seedCompanyEmployees(
  db: D1Database,
  employees: ReadonlyArray<CompanyEmployeeFixture>,
): Promise<void> {
  for (const employee of employees) {
    const id = employeeId(employee)
    const actionId = personnelActionId(employee)
    const currentEmploymentId = employmentId(employee)
    const status = employee.status ?? "active"
    const terminationDate = status === "retired" ? "2024-12-31" : null
    const persistedStatus =
      status === "retired" ? "TERMINATED" : status === "leave" ? "ON_LEAVE" : "ACTIVE"
    const summary = JSON.stringify({
      kind: "initial_state",
      eventOn: baselineOn,
      department: null,
      positionTitle: employee.position ?? null,
      managerEmployeeCode: null,
      status,
    })

    const statements = [
      db
        .prepare(
          `INSERT OR IGNORE INTO company_employees
             (id, official_name, employee_code, email, phone, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?5)`,
        )
        .bind(id, employee.name, employee.code ?? null, employee.email ?? null, recordedAt),
      db
        .prepare(
          `INSERT OR IGNORE INTO company_employments
             (id, employee_id, contract_name, employment_type, hire_date, status,
              termination_date, created_at, updated_at)
           VALUES (?1, ?2, ?3, 'FULL_TIME', '2024-01-01', ?4, ?5, ?6, ?6)`,
        )
        .bind(currentEmploymentId, id, employee.name, persistedStatus, terminationDate, recordedAt),
      db
        .prepare(
          `INSERT OR IGNORE INTO company_personnel_actions
             (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
              requested_by_employee_id, source_type, source_application_id,
              corrects_action_id, operation_id, payload_fingerprint, summary_json)
           VALUES (?1, ?2, 'initial_state', ?3, ?4, NULL, NULL, 'system', NULL,
                   NULL, ?5, ?6, ?7)`,
        )
        .bind(actionId, id, baselineOn, recordedAt, actionId, fingerprint, summary),
      db
        .prepare(
          `INSERT OR IGNORE INTO company_employee_lifecycle_revisions
             (employee_id, revision, updated_at) VALUES (?1, 0, ?2)`,
        )
        .bind(id, recordedAt),
    ]

    if (status !== "retired") {
      statements.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO company_employment_period_versions
               (period_id, revision, employee_id, starts_on, ends_on, is_void,
                recorded_by_action_id, recorded_at)
             VALUES (?1, 1, ?2, ?3, NULL, 0, ?4, ?5)`,
          )
          .bind(currentEmploymentId, id, baselineOn, actionId, recordedAt),
        db
          .prepare(
            `INSERT OR IGNORE INTO company_employee_status_period_versions
               (period_id, revision, employment_period_id, employee_id, status,
                starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
             VALUES (?1, 1, ?2, ?3, ?4, ?5, NULL, 0, ?6, ?7)`,
          )
          .bind(
            `test:${id}:status`,
            currentEmploymentId,
            id,
            status,
            baselineOn,
            actionId,
            recordedAt,
          ),
      )
    }

    const results = await db.batch(statements)
    if (results.length !== statements.length || results.some((result) => !result.success)) {
      throw new Error(`Company employee fixture ${id} was not persisted atomically`)
    }
  }
}

/** 現行Company組織台帳へUnit・配属・責務を一つの組織変更として投入する。 */
export async function seedCompanyOrganization(
  db: D1Database,
  props: Readonly<{
    employees: ReadonlyArray<CompanyEmployeeFixture>
    departments: ReadonlyArray<CompanyDepartmentFixture>
    memberships?: ReadonlyArray<CompanyMembershipFixture>
  }>,
): Promise<void> {
  const memberships = props.memberships ?? []
  const activeEmployees = props.employees.filter((employee) => employee.status !== "retired")
  const employeesByCode = new Map(
    props.employees.flatMap((employee) =>
      employee.code === undefined || employee.code === null
        ? []
        : [[employee.code, employee] as const],
    ),
  )
  const assignments = activeEmployees.flatMap((employee) => {
    const primary = departmentFor(employee, props.departments)
    const concurrent =
      employee.code === undefined || employee.code === null
        ? []
        : memberships
            .filter(
              (membership) =>
                membership.employeeCode === employee.code &&
                membership.departmentCode !== primary?.code,
            )
            .flatMap((membership) => {
              const department = props.departments.find(
                (candidate) => candidate.code === membership.departmentCode,
              )
              return department === undefined
                ? []
                : [
                    {
                      employee,
                      department,
                      assignmentType: "CONCURRENT" as const,
                      positionTitle: null,
                      managerEmployeeCode: membership.managerEmployeeCode ?? null,
                    },
                  ]
            })

    return [
      ...(primary === null
        ? []
        : [
            {
              employee,
              department: primary,
              assignmentType: "PRIMARY" as const,
              positionTitle: employee.position ?? null,
              managerEmployeeCode: managerCodeFor(employee, primary.code, memberships),
            },
          ]),
      ...concurrent,
    ]
  })
  const responsibilities = props.departments.flatMap((department) => {
    const manager =
      department.managerEmployeeCode === undefined || department.managerEmployeeCode === null
        ? undefined
        : employeesByCode.get(department.managerEmployeeCode)
    if (manager === undefined || manager.status === "retired") return []
    if (
      assignments.some(
        (assignment) =>
          assignment.employee === manager && assignment.department.code === department.code,
      ) === false
    ) {
      return []
    }
    return [{ employee: manager, department }]
  })
  const changeCount = props.departments.length + assignments.length + responsibilities.length
  if (changeCount === 0) return

  const expectedRevision =
    (await db
      .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
      .first<number>("revision")) ?? 0
  const operationId = `test:organization:${expectedRevision}`

  for (const department of props.departments) {
    await db
      .prepare("INSERT OR IGNORE INTO company_organization_units (id, created_at) VALUES (?1, ?2)")
      .bind(`department:${department.code}`, recordedAt)
      .run()
  }

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO company_organization_change_operations
           (id, expected_revision, change_count, applied_count, resulting_revision, status,
            recorded_at, request_fingerprint, actor_account_id, reason,
            evidence_references_json)
         VALUES (?1, ?2, ?3, 0, ?4, 'PENDING', ?5, ?6, 'system:test',
                 'Initialize canonical Company test organization', '[]')`,
      )
      .bind(
        operationId,
        expectedRevision,
        changeCount,
        expectedRevision + changeCount,
        recordedAt,
        fingerprint,
      ),
  ]

  for (const department of props.departments) {
    statements.push(
      db
        .prepare(
          `INSERT INTO company_organization_unit_period_versions
             (period_id, revision, organization_unit_id, code, official_name, kind,
              parent_organization_unit_id, starts_on, ends_on, is_void,
              recorded_by_action_id, recorded_at)
           VALUES (?1, 1, ?2, ?3, ?4, 'DEPARTMENT', ?5, ?6, NULL, 0, ?7, ?8)`,
        )
        .bind(
          `test:department:${department.code}`,
          `department:${department.code}`,
          department.code,
          department.name,
          department.parentCode === undefined || department.parentCode === null
            ? "company:root"
            : `department:${department.parentCode}`,
          baselineOn,
          operationId,
          recordedAt,
        ),
    )
  }

  for (const assignment of assignments) {
    const id = employeeId(assignment.employee)
    const manager =
      assignment.managerEmployeeCode === null
        ? null
        : employeesByCode.get(assignment.managerEmployeeCode)
    statements.push(
      db
        .prepare(
          `INSERT INTO company_organization_assignment_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              assignment_type, position_title, manager_employee_id, starts_on, ends_on,
              is_void, recorded_by_action_id, recorded_at)
           VALUES (?1, 1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, 0, ?9, ?10)`,
        )
        .bind(
          `test:assignment:${id}:${assignment.assignmentType.toLowerCase()}:${assignment.department.code}`,
          employmentId(assignment.employee),
          id,
          `department:${assignment.department.code}`,
          assignment.assignmentType,
          assignment.positionTitle,
          manager === undefined || manager === null ? null : employeeId(manager),
          baselineOn,
          operationId,
          recordedAt,
        ),
    )
  }

  for (const responsibility of responsibilities) {
    const id = employeeId(responsibility.employee)
    statements.push(
      db
        .prepare(
          `INSERT INTO company_organization_responsibility_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              responsibility_type, starts_on, ends_on, is_void,
              recorded_by_action_id, recorded_at)
           VALUES (?1, 1, ?2, ?3, ?4, 'MANAGER', ?5, NULL, 0, ?6, ?7)`,
        )
        .bind(
          `test:responsibility:${id}:manager:${responsibility.department.code}`,
          employmentId(responsibility.employee),
          id,
          `department:${responsibility.department.code}`,
          baselineOn,
          operationId,
          recordedAt,
        ),
    )
  }

  statements.push(
    db
      .prepare(
        "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = ?1",
      )
      .bind(operationId),
  )

  const results = await db.batch(statements)
  if (results.length !== statements.length || results.some((result) => !result.success)) {
    throw new Error("Company organization fixture was not persisted atomically")
  }
}

export async function seedCompanyTestState(
  db: D1Database,
  props: Readonly<{
    employees: ReadonlyArray<CompanyEmployeeFixture>
    departments: ReadonlyArray<CompanyDepartmentFixture>
    memberships?: ReadonlyArray<CompanyMembershipFixture>
  }>,
): Promise<void> {
  await seedCompanyEmployees(db, props.employees)
  await seedCompanyOrganization(db, props)
}
