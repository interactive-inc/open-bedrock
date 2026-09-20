import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"

const rowSchema = z.object({
  id: z.number().int().positive(),
  org_role_code: z.string().min(1),
  employee_id: z.string().min(1),
  employee_code: z.string().min(1),
  department_code: z.string().nullable(),
  starts_on: z.string().date(),
  ends_on: z.string().date().nullable(),
  source_document_code: z.string().nullable(),
  created_by_account_id: z.string().min(1),
  created_at: z.string().datetime(),
  revoked_by_account_id: z.string().nullable(),
  revoked_at: z.string().datetime().nullable(),
})

type Snapshot = Readonly<{
  source: z.infer<typeof rowSchema>
  sourceJson: string
  snapshotDigest: string
}>

type Context = Readonly<{ database: D1Database; now?: string | number; timeZone?: string }>

/** 旧組織ロール割当の全列を、Companyへ接続する直前の同一性確認として固定する。 */
export class GovernanceRoleAssignmentAdoptionSnapshotAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(assignmentId: number): Promise<Snapshot | null | Error> {
    try {
      const row = await this.c.database
        .prepare(
          `SELECT assignment.id, assignment.org_role_code,
          CAST(assignment.employee_id AS TEXT) AS employee_id,
          assignment.department_code, assignment.starts_on, assignment.ends_on,
          assignment.source_document_code, assignment.created_by_account_id,
          assignment.created_at, assignment.revoked_by_account_id, assignment.revoked_at
        FROM governance_org_role_assignments assignment WHERE assignment.id = ?1`,
        )
        .bind(assignmentId)
        .first<Record<string, unknown>>()
      if (row === null) return null
      const employeeId = zEmployeeId.safeParse(row.employee_id)
      if (!employeeId.success)
        return new Error("invalid governance responsibility source", { cause: employeeId.error })
      // 従業員番号はCompanyの会社営業日の名簿から取る。会社に存在しない従業員の割当は元記録として扱わない。
      const employees = await new CompanyEmployeeDirectoryReadAdapter({
        env: {
          DB: this.c.database,
          NOW: this.c.now === undefined ? undefined : new Date(this.c.now).toISOString(),
          COMPANY_TIME_ZONE: this.c.timeZone,
        },
      }).findForEmployeeIds([employeeId.data])
      if (employees instanceof Error) return employees
      const employee = employees.at(0)
      if (employee === undefined) return null
      const { employee_id, ...rest } = row
      const { id, org_role_code, ...remaining } = rest
      return this.restore({
        id,
        org_role_code,
        employee_id,
        employee_code: employee.employeeCode,
        ...remaining,
      })
    } catch (cause) {
      return new Error("governance responsibility source is unavailable", { cause })
    }
  }

  private async restore(row: unknown): Promise<Snapshot | Error> {
    const parsed = rowSchema.safeParse(row)
    if (!parsed.success)
      return new Error("invalid governance responsibility source", { cause: parsed.error })
    const canonical = CanonicalSystemJsonValue.create(parsed.data)
    if (canonical instanceof Error) return canonical
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return digest
    return Object.freeze({
      source: Object.freeze(parsed.data),
      sourceJson: canonical.toString(),
      snapshotDigest: digest.toString(),
    })
  }
}
