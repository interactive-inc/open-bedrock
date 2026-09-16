import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { PrepareExpensePreservationReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-preservation-read.adapter"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"

type Context = CompanyContext & Readonly<{ now: () => Date }>
const snapshotSql = `SELECT json_object(
  'format','expense-budget','version',1,
  'record',json_object('id',id,'organization_unit_id',organization_unit_id,'fiscal_period',fiscal_period,
    'period_start',period_start,'period_end',period_end,'amount',amount,'name',name,'note',note,'created_at',created_at)
) AS snapshot_json FROM expense_budgets WHERE id=?1`

/** 部署予算の全保存列を取得し、現在の消化額や組織名を元記録へ混ぜない。 */
export class CaptureExpenseBudgetRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      budgetId: number
      sourceNamespace: string
      authentication: SystemReadAuthentication
      session: CompanyPersonnelSession
    }>,
  ) {
    if (!Number.isSafeInteger(input.budgetId)) return new Error("invalid expense record")
    const now = this.c.now()
    const authorized = await new PrepareExpensePreservationReadAdapter(this.c).prepare({
      ...input,
      permission: "budget:manage",
      at: now,
    })
    if (authorized instanceof Error) return authorized
    const initial = authorized.assertions(this.c.now())
    if (initial instanceof Error) return initial
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...initial,
        this.c.env.DB.prepare(snapshotSql).bind(input.budgetId),
      ])
      if (reads.length !== initial.length + 1 || reads.some((read) => !read.success))
        return new Error("expense record is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("expense record is unavailable")
      const content = new TextEncoder().encode(snapshot)
      const digest = await toSha256Hex(content)
      const recordId = String(input.budgetId)
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "expense",
        recordKind: "expense-budget",
        recordId,
        formatId: "expense-budget",
        formatVersion: 1,
        sourceRevision: null,
        sourceRecordedAt: null,
        capturedAt: now.toISOString(),
        contentDigest: digest,
      })
      if (source instanceof Error) return source
      const current = authorized.assertions(this.c.now())
      if (current instanceof Error) return current
      const assertions = Object.freeze([
        ...current,
        this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1
          ELSE json_extract('{}','expense_budget_changed') END`).bind(input.budgetId, snapshot),
      ])
      const checked = await this.c.env.DB.batch([...assertions])
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("expense record changed")
      return Object.freeze({
        source,
        content,
        actorAccountId: input.authentication.accountId,
        sourceAuthorizationRef: Object.freeze({
          context: "expense",
          kind: "expense-budget",
          id: recordId,
          version: digest,
        }),
        assertions,
      })
    } catch (cause) {
      return new Error("expense record capture failed", { cause })
    }
  }
}
