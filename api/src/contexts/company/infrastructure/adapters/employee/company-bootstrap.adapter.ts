export type CompanyBootstrapResult = Readonly<{
  employeeId: string | null
  state: "created" | "already_initialized" | "company_exists_without_account_link"
}>

type CompanyBootstrapWrite = Readonly<{
  accountId: string
  employeeCode: string
  employeeName: string
  organizationName: string
  effectiveOn: string
  occurredAt: Date
}>
type CompanyBootstrapAdapterContext = D1Database
type Context = CompanyBootstrapAdapterContext

/** 空のCompanyを、System rootに対応する最初のEmployeeとCompany正本へ原子的に初期化する。 */
export class CompanyBootstrapAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async provision(write: CompanyBootstrapWrite): Promise<CompanyBootstrapResult | Error> {
    const existing = await this.readExisting(write.accountId)
    if (existing instanceof Error || existing !== null) {
      return existing ?? new Error("Company bootstrap state is unavailable")
    }

    const companyExists = await this.hasAnyEmployee()
    if (companyExists instanceof Error) return companyExists
    if (companyExists) {
      return Object.freeze({
        employeeId: null,
        state: "company_exists_without_account_link" as const,
      })
    }

    const employeeId = crypto.randomUUID()
    const actionId = `bootstrap:employee:${employeeId}`
    const employmentId = `employment:${crypto.randomUUID()}`
    const organizationActionId = `bootstrap:organization:${employeeId}`
    const recordedAt = write.occurredAt.getTime()
    const actionRecordedAt = Math.floor(recordedAt / 1_000)
    const summaryJson = JSON.stringify({
      kind: "initial_state",
      eventOn: write.effectiveOn,
      department: { code: "COMPANY", name: write.organizationName },
      positionTitle: null,
      managerEmployeeCode: null,
      status: "active",
    })

    const statements: D1PreparedStatement[] = [
      this.c
        .prepare(
          `INSERT INTO company_employees
             (id, official_name, employee_code, email, phone, created_at, updated_at)
           VALUES (?1, ?2, ?3, NULL, NULL, ?4, ?4)`,
        )
        .bind(employeeId, write.employeeName, write.employeeCode, recordedAt),
      this.c
        .prepare(
          `INSERT INTO company_employments
             (id, employee_id, contract_name, employment_type, hire_date, status,
              termination_date, created_at, updated_at)
           VALUES (?1, ?2, ?3, 'FULL_TIME', ?4, 'ACTIVE', NULL, ?5, ?5)`,
        )
        .bind(employmentId, employeeId, write.employeeName, write.effectiveOn, recordedAt),
      this.c
        .prepare(
          `INSERT INTO company_account_employee_links (account_id, employee_id)
           VALUES (?1, ?2)`,
        )
        .bind(write.accountId, employeeId),
      this.c
        .prepare(
          `INSERT INTO company_account_profiles
             (organization_id, account_id, display_name, created_at, updated_at)
           VALUES ('organization:default', ?1, ?2, ?3, ?3)`,
        )
        .bind(write.accountId, write.employeeName, recordedAt),
      this.c
        .prepare(
          `INSERT INTO company_personnel_actions
             (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
              requested_by_employee_id, source_type, source_application_id,
              corrects_action_id, operation_id, payload_fingerprint, summary_json)
           VALUES (?1, ?2, 'initial_state', ?3, ?4, ?5, NULL, 'system', NULL,
                   NULL, ?1, ?6, ?7)`,
        )
        .bind(
          actionId,
          employeeId,
          write.effectiveOn,
          actionRecordedAt,
          write.accountId,
          "0".repeat(64),
          summaryJson,
        ),
      this.c
        .prepare(
          `INSERT INTO company_employment_period_versions
             (period_id, revision, employee_id, starts_on, ends_on, is_void,
              recorded_by_action_id, recorded_at)
           VALUES (?1, 1, ?2, ?3, NULL, 0, ?4, ?5)`,
        )
        .bind(employmentId, employeeId, write.effectiveOn, actionId, actionRecordedAt),
      this.c
        .prepare(
          `INSERT INTO company_employee_status_period_versions
             (period_id, revision, employment_period_id, employee_id, status,
              starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
           VALUES (?1, 1, ?2, ?3, 'active', ?4, NULL, 0, ?5, ?6)`,
        )
        .bind(
          `bootstrap-status:${employeeId}`,
          employmentId,
          employeeId,
          write.effectiveOn,
          actionId,
          actionRecordedAt,
        ),
      this.c
        .prepare(
          `INSERT INTO company_employee_lifecycle_revisions
             (employee_id, revision, updated_at)
           VALUES (?1, 0, ?2)`,
        )
        .bind(employeeId, actionRecordedAt),
      this.c
        .prepare(
          `INSERT INTO company_organization_change_operations
             (id, expected_revision, change_count, applied_count, resulting_revision,
              status, recorded_at, request_fingerprint, actor_account_id, reason,
              evidence_references_json)
           SELECT ?1, revision, 3, 0, revision + 3, 'PENDING', ?2, ?3, ?4,
                  'Initialize Company workforce', '[]'
           FROM company_organization_lifecycle_states WHERE id = 1`,
        )
        .bind(organizationActionId, recordedAt, "0".repeat(64), write.accountId),
      this.c
        .prepare(
          `INSERT INTO company_organization_assignment_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              assignment_type, position_title, manager_employee_id, starts_on, ends_on,
              is_void, recorded_by_action_id, recorded_at)
           VALUES (?1, 1, ?2, ?3, 'company:root', 'PRIMARY', NULL, NULL, ?4,
                   NULL, 0, ?5, ?6)`,
        )
        .bind(
          `bootstrap-assignment:${employeeId}`,
          employmentId,
          employeeId,
          write.effectiveOn,
          organizationActionId,
          recordedAt,
        ),
      ...["MANAGER", "PEOPLE_OPERATIONS"].map((responsibilityType) =>
        this.c
          .prepare(
            `INSERT INTO company_organization_responsibility_period_versions
               (period_id, revision, employment_id, employee_id, organization_unit_id,
                responsibility_type, starts_on, ends_on, is_void,
                recorded_by_action_id, recorded_at)
             VALUES (?1, 1, ?2, ?3, 'company:root', ?4, ?5, NULL, 0, ?6, ?7)`,
          )
          .bind(
            `bootstrap-responsibility:${responsibilityType.toLowerCase()}:${employeeId}`,
            employmentId,
            employeeId,
            responsibilityType,
            write.effectiveOn,
            organizationActionId,
            recordedAt,
          ),
      ),
      this.c
        .prepare(
          `UPDATE company_organization_change_operations
           SET status = 'COMPLETED'
           WHERE id = ?1 AND status = 'PENDING'`,
        )
        .bind(organizationActionId),
      this.c
        .prepare(
          `UPDATE company_organizations
           SET revision = revision + 1, name = ?1, representative_name = ?2, updated_at = ?3
           WHERE id = 'organization:default' AND revision = 0`,
        )
        .bind(write.organizationName, write.employeeName, recordedAt),
    ]

    try {
      const results = await this.c.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("Company bootstrap batch did not succeed")
      }
    } catch (cause) {
      const raced = await this.readExisting(write.accountId)
      if (raced instanceof Error || raced !== null) {
        return raced ?? new Error("Company bootstrap state is unavailable")
      }
      return cause instanceof Error ? cause : new Error("Company bootstrap failed")
    }

    return Object.freeze({ employeeId, state: "created" as const })
  }

  private async readExisting(accountId: string): Promise<CompanyBootstrapResult | null | Error> {
    try {
      const employeeId = await this.c
        .prepare(
          `SELECT employee_id
           FROM company_account_employee_links
           WHERE account_id = ?1`,
        )
        .bind(accountId)
        .first<string>("employee_id")
      return employeeId === null
        ? null
        : Object.freeze({ employeeId, state: "already_initialized" as const })
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to read Company bootstrap state")
    }
  }

  private async hasAnyEmployee(): Promise<boolean | Error> {
    try {
      return (
        (await this.c.prepare(`SELECT id FROM company_employees LIMIT 1`).first<string>("id")) !==
        null
      )
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to read Company Employee state")
    }
  }
}
