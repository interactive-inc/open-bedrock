import type {
  CompanyBootstrapEmployeeRepository,
  CompanyBootstrapEmployeeResult,
  CompanyBootstrapEmployeeWrite,
} from "@/contexts/company/infrastructure/employee/company-bootstrap-employee-port.repository"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context.repository"

/** Company EmployeeとAccount linkだけを原子的に保存するD1 adapter。 */
export class CompanyBootstrapEmployeeRepositoryD1 implements CompanyBootstrapEmployeeRepository {
  constructor(private readonly context: SystemD1Context) {
    Object.freeze(this)
  }

  async provision(
    write: CompanyBootstrapEmployeeWrite,
  ): Promise<CompanyBootstrapEmployeeResult | Error> {
    const existing = await this.readExisting(write.accountId)
    if (existing instanceof Error || existing !== null) return existing ?? new Error("unreachable")

    const companyExists = await this.hasAnyEmployee()
    if (companyExists instanceof Error) return companyExists
    if (companyExists) return this.companyExistsWithoutAccountLink()

    const database = this.context.env.DB
    try {
      const statements = [
        database
          .prepare(
            `INSERT INTO employees (code, name, status)
             SELECT ?1, ?2, 'active'
             WHERE NOT EXISTS (SELECT 1 FROM employees)
               AND NOT EXISTS (
                 SELECT 1 FROM account_employee_links WHERE account_id = ?3
               )`,
          )
          .bind(write.employeeCode, write.name, write.accountId),
        database.prepare(
          `SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok`,
        ),
        database
          .prepare(
            `INSERT INTO account_employee_links (account_id, employee_id)
             SELECT ?1, id FROM employees WHERE code = ?2`,
          )
          .bind(write.accountId, write.employeeCode),
        database.prepare(
          `SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok`,
        ),
        database
          .prepare(
            `INSERT INTO company_account_profiles
               (organization_id, account_id, display_name, created_at, updated_at)
             VALUES ('organization:default', ?1, ?2, ?3, ?3)`,
          )
          .bind(write.accountId, write.name, write.occurredAt.getTime()),
      ]
      const results = await database.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("Company bootstrap employee batch did not succeed")
      }
    } catch (caught) {
      const raced = await this.readExisting(write.accountId)
      if (raced instanceof Error || raced !== null) return raced ?? new Error("unreachable")
      const racedCompany = await this.hasAnyEmployee()
      if (racedCompany instanceof Error) return racedCompany
      if (racedCompany) return this.companyExistsWithoutAccountLink()

      return caught instanceof Error ? caught : new Error("Company bootstrap employee failed")
    }

    const created = await this.readExisting(write.accountId)
    if (created instanceof Error || created === null || created.employeeId === null) {
      return created instanceof Error
        ? created
        : new Error("Company bootstrap Employee link is missing")
    }
    return Object.freeze({
      kind: "created" as const,
      employeeId: created.employeeId,
      state: "complete" as const,
    })
  }

  private async readExisting(
    accountId: string,
  ): Promise<CompanyBootstrapEmployeeResult | null | Error> {
    try {
      const employeeId = await this.context.env.DB.prepare(
        `SELECT employee_id FROM account_employee_links WHERE account_id = ?1`,
      )
        .bind(accountId)
        .first<number>("employee_id")
      if (employeeId === null) return null

      return Object.freeze({
        kind: "already_initialized" as const,
        employeeId,
        state: "complete" as const,
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read Company bootstrap state")
    }
  }

  private async hasAnyEmployee(): Promise<boolean | Error> {
    try {
      const employeeId = await this.context.env.DB.prepare(
        "SELECT id FROM employees LIMIT 1",
      ).first<number>("id")
      return employeeId !== null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read Company Employee state")
    }
  }

  private companyExistsWithoutAccountLink(): CompanyBootstrapEmployeeResult {
    return Object.freeze({
      kind: "already_initialized" as const,
      employeeId: null,
      state: "company_exists_without_account_link" as const,
    })
  }
}
