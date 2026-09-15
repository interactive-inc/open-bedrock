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

type Context = Readonly<{ database: D1Database }>

/** 旧組織ロール割当の全列を、Companyへ接続する直前の同一性確認として固定する。 */
export class GovernanceRoleAssignmentAdoptionSnapshotAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(assignmentId: number): Promise<Snapshot | null | Error> {
    try {
      const row = await this.c.database
        .prepare(`${this.selectSource()} WHERE assignment.id = ?1`)
        .bind(assignmentId)
        .first()
      if (row === null) return null
      return this.restore(row)
    } catch (cause) {
      return new Error("governance responsibility source is unavailable", { cause })
    }
  }

  private selectSource(): string {
    return `SELECT assignment.id, assignment.org_role_code,
          CAST(assignment.employee_id AS TEXT) AS employee_id, employee.employee_code,
          assignment.department_code, assignment.starts_on, assignment.ends_on,
          assignment.source_document_code, assignment.created_by_account_id,
          assignment.created_at, assignment.revoked_by_account_id, assignment.revoked_at
        FROM governance_org_role_assignments assignment
        JOIN company_employees employee ON employee.id = assignment.employee_id`
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
