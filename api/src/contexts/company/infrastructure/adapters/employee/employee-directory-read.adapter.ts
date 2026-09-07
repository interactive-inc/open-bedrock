import type { CompanyEmployeeDirectoryEntry } from "@/contexts/company/domain/definitions/employee-directory-entry.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { companyEmployeeDirectorySql } from "@/contexts/company/infrastructure/adapters/employee/lib/company-employee-directory-sql"
import { z } from "zod"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"

const employeeDirectoryRow = z.object({
  id: z.string(),
  official_name: z.string(),
  employee_code: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  employment_id: z.string().nullable(),
  employment_status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]).nullable(),
  employment_valid: z.number().nullable(),
  organization_unit_id: z.string().nullable(),
  organization_unit_code: z.string().nullable(),
  organization_unit_name: z.string().nullable(),
  position_title: z.string().nullable(),
  assignment_employment_id: z.string().nullable(),
  assignment_count: z.number().nullable(),
  unit_count: z.number().nullable(),
})
type EmployeeDirectoryRow = z.infer<typeof employeeDirectoryRow>

export type CompanyEmployeeDirectoryPage = Readonly<{
  employees: ReadonlyArray<CompanyEmployeeDirectoryEntry>
  total: number
}>
export type CompanyAccountEmployeeDirectoryEntry = Readonly<{
  accountId: AccountId
  employee: CompanyEmployeeDirectoryEntry
}>

type Context = Readonly<{ env: CompanyContext["env"]; asOf?: CalendarDate }>

/** 会社営業日の期間履歴を使い、一覧と単体参照の在籍判定を揃える。 */
export class CompanyEmployeeDirectoryReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  findById(employeeId: EmployeeId): Promise<CompanyEmployeeDirectoryEntry | null | Error> {
    return this.find("employee.id = ?2", employeeId)
  }

  findByCode(employeeCode: string): Promise<CompanyEmployeeDirectoryEntry | null | Error> {
    return this.find("employee.employee_code = ?2", employeeCode)
  }

  async findForEmployeeIds(
    employeeIds: ReadonlyArray<EmployeeId>,
  ): Promise<ReadonlyArray<CompanyEmployeeDirectoryEntry> | Error> {
    const unique = [...new Set(employeeIds)]
    if (unique.length === 0) return []
    const businessDate = this.businessDate()
    if (businessDate instanceof Error) return businessDate

    try {
      const statements: D1PreparedStatement[] = []
      for (let offset = 0; offset < unique.length; offset += 99) {
        const chunk = unique.slice(offset, offset + 99)
        const placeholders = chunk.map((_, index) => `?${index + 2}`).join(", ")
        statements.push(
          this.c.env.DB.prepare(
            `${companyEmployeeDirectorySql()} ${this.selectSql()} ${this.fromSql()}
             WHERE employee.id IN (${placeholders}) ORDER BY employee.id`,
          ).bind(businessDate, ...chunk),
        )
      }
      const snapshots = await this.c.env.DB.batch(statements)
      if (snapshots.length !== statements.length || snapshots.some((snapshot) => !snapshot.success))
        return new Error("failed to read Company employee snapshot")
      const entries: CompanyEmployeeDirectoryEntry[] = []
      const seen = new Set<EmployeeId>()
      for (const snapshot of snapshots) {
        for (const row of snapshot.results) {
          const employee = this.restore(row)
          if (employee instanceof Error) return employee
          if (seen.has(employee.id)) return new Error("Company employee identity is ambiguous")
          seen.add(employee.id)
          entries.push(employee)
        }
      }
      return entries
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to read Company employees")
    }
  }

  async findForAccountIds(
    accountIds: ReadonlyArray<AccountId>,
  ): Promise<ReadonlyArray<CompanyAccountEmployeeDirectoryEntry> | Error> {
    const unique = [...new Set(accountIds)]
    if (unique.length === 0) return []
    const businessDate = this.businessDate()
    if (businessDate instanceof Error) return businessDate

    const statements: D1PreparedStatement[] = []
    for (let offset = 0; offset < unique.length; offset += 99) {
      const chunk = unique.slice(offset, offset + 99)
      const placeholders = chunk.map((_, index) => `?${index + 2}`).join(", ")
      statements.push(
        this.c.env.DB.prepare(
          `${companyEmployeeDirectorySql()} ${this.selectSql()}, link.account_id
         ${this.fromSql()}
         JOIN company_account_employee_link_periods AS link ON link.employee_id = employee.id
           AND (link.starts_on IS NULL OR link.starts_on <= ?1) AND (link.ends_on IS NULL OR ?1 < link.ends_on)
         WHERE link.account_id IN (${placeholders}) ORDER BY link.account_id`,
        ).bind(businessDate, ...chunk),
      )
    }

    try {
      const snapshots = await this.c.env.DB.batch(statements)
      if (
        snapshots.length !== statements.length ||
        snapshots.some((snapshot) => !snapshot.success)
      ) {
        return new Error("failed to read Company Account employee snapshot")
      }
      const entries: CompanyAccountEmployeeDirectoryEntry[] = []
      const seen = new Set<AccountId>()
      for (const snapshot of snapshots) {
        for (const row of snapshot.results) {
          const link = z.object({ account_id: zAccountId }).safeParse(row)
          if (!link.success) return link.error
          if (seen.has(link.data.account_id))
            return new Error("Company Account employee is ambiguous")
          const employee = this.restore(row)
          if (employee instanceof Error) return employee
          seen.add(link.data.account_id)
          entries.push({ accountId: link.data.account_id, employee })
        }
      }
      return entries
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to read Company Account employees")
    }
  }

  async list(input: {
    query: string | null
    organizationUnit: string | null
    status: "active" | "leave" | "retired" | null
    limit: number
    offset: number
  }): Promise<CompanyEmployeeDirectoryPage | Error> {
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100 ||
      !Number.isSafeInteger(input.offset) ||
      input.offset < 0 ||
      input.offset > 10_000
    )
      return new Error("invalid Company employee directory page")

    const businessDate = this.businessDate()
    if (businessDate instanceof Error) return businessDate

    const conditions: string[] = []
    const values: Array<string | number> = [businessDate]
    if (input.query !== null) {
      conditions.push(
        "(instr(lower(employee.official_name), lower(?)) > 0 OR instr(lower(coalesce(employee.employee_code, '')), lower(?)) > 0)",
      )
      values.push(input.query, input.query)
    }
    if (input.organizationUnit !== null) {
      conditions.push("(unit.code = ? OR unit.official_name = ?)")
      values.push(input.organizationUnit, input.organizationUnit)
    }
    if (input.status !== null) {
      conditions.push("(employment.status = ? OR employment.is_valid = 0)")
      values.push(
        input.status === "active" ? "ACTIVE" : input.status === "leave" ? "ON_LEAVE" : "TERMINATED",
      )
    }
    const where = conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`
    const source = `${this.fromSql()} ${where}`

    try {
      const snapshot = await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `${companyEmployeeDirectorySql()} ${this.selectSql()} ${source}
           ORDER BY employee.employee_code, employee.id LIMIT ? OFFSET ?`,
        ).bind(...values, input.limit, input.offset),
        this.c.env.DB.prepare(
          `${companyEmployeeDirectorySql()} SELECT count(*) AS total ${source}`,
        ).bind(...values),
      ])
      const rows = snapshot[0]
      const count = snapshot[1]
      if (snapshot.length !== 2 || !rows?.success || !count?.success) {
        return new Error("failed to read Company employee directory snapshot")
      }
      const total = z.object({ total: z.number().int().nonnegative() }).safeParse(count.results[0])
      if (!total.success) return total.error

      const employees: CompanyEmployeeDirectoryEntry[] = []
      for (const row of rows.results) {
        const employee = this.restore(row)
        if (employee instanceof Error) return employee
        employees.push(employee)
      }
      return { employees, total: total.data.total }
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to list Company employee directory")
    }
  }

  private async find(
    predicate: string,
    value: EmployeeId | string,
  ): Promise<CompanyEmployeeDirectoryEntry | null | Error> {
    const businessDate = this.businessDate()
    if (businessDate instanceof Error) return businessDate

    try {
      const rows = await this.c.env.DB.prepare(
        `${companyEmployeeDirectorySql()} ${this.selectSql()} ${this.fromSql()}
         WHERE ${predicate} LIMIT 2`,
      )
        .bind(businessDate, value)
        .all()
      if (!rows.success) return new Error("failed to read Company employee directory")
      if (rows.results.length === 0) return null
      if (rows.results.length !== 1) return new Error("Company employee identity is ambiguous")

      return this.restore(rows.results[0])
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to read Company employee directory")
    }
  }

  private businessDate() {
    if (this.c.asOf !== undefined) return this.c.asOf
    return resolveCompanyBusinessDate({
      now: this.c.env.NOW ?? new Date().toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
  }

  private selectSql(): string {
    return `SELECT employee.id, employee.official_name, employee.employee_code,
      employee.email, employee.phone,
      employment.id AS employment_id, employment.status AS employment_status,
      employment.is_valid AS employment_valid,
      assignment.organization_unit_id, assignment.position_title,
      assignment.employment_id AS assignment_employment_id,
      assignment.matching_count AS assignment_count,
      unit.code AS organization_unit_code, unit.official_name AS organization_unit_name,
      unit.matching_count AS unit_count`
  }

  private fromSql(): string {
    return `FROM current_employees AS employee
      LEFT JOIN current_employment AS employment ON employment.employee_id = employee.id
      LEFT JOIN current_assignment AS assignment ON assignment.employee_id = employee.id
      LEFT JOIN current_unit AS unit ON unit.organization_unit_id = assignment.organization_unit_id`
  }

  private restore(value: unknown): CompanyEmployeeDirectoryEntry | Error {
    const parsed = employeeDirectoryRow.safeParse(value)
    if (!parsed.success) return parsed.error
    const row = parsed.data
    if (!this.isConsistent(row)) {
      return new Error(
        "Company employee directory contains an incomplete or ambiguous period snapshot",
      )
    }

    return Object.freeze({
      id: restoreWorkforceId("employee", row.id),
      officialName: row.official_name,
      employeeCode: row.employee_code,
      email: row.email,
      phone: row.phone,
      employment:
        row.employment_id === null || row.employment_status === null
          ? null
          : Object.freeze({
              id: restoreWorkforceId("employment", row.employment_id),
              status: row.employment_status,
            }),
      primaryAssignment:
        row.organization_unit_id === null ||
        row.organization_unit_code === null ||
        row.organization_unit_name === null
          ? null
          : Object.freeze({
              organizationUnitId: row.organization_unit_id,
              organizationUnitCode: row.organization_unit_code,
              organizationUnitName: row.organization_unit_name,
              positionTitle: row.position_title,
            }),
    })
  }

  private isConsistent(row: EmployeeDirectoryRow): boolean {
    if ((row.employment_id === null) !== (row.employment_status === null)) return false
    if (row.employment_id !== null && row.employment_valid !== 1) return false
    if ((row.organization_unit_id === null) !== (row.organization_unit_code === null)) return false
    if ((row.organization_unit_id === null) !== (row.organization_unit_name === null)) return false
    if (row.assignment_count === null) return row.organization_unit_id === null
    if (row.assignment_count !== 1 || row.unit_count !== 1) return false

    return (
      row.assignment_employment_id === row.employment_id &&
      (row.employment_status === "ACTIVE" || row.employment_status === "ON_LEAVE")
    )
  }
}
