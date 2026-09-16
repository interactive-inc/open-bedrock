import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { PrepareExpenseRecordReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-record-read.adapter"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"

type Context = CompanyContext & Readonly<{ now: () => Date }>
const snapshotSql = `SELECT json_object(
  'format','expense-procedure-binding','version',1,
  'record',json_object('request_key',request_key,'expense_id',expense_id,'previous_expense_id',previous_expense_id,
    'application_id',application_id,'series_id',series_id,'case_id',case_id,'proposal_digest',proposal_digest,
    'attachment_evidence_json',attachment_evidence_json,'created_at',created_at)
) AS snapshot_json FROM expense_procedure_bindings WHERE expense_id=?1`

/** 申請と承認対象・原添付証拠・再申請元の対応を保存値のまま取得する。 */
export class CaptureExpenseProcedureBindingAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      expenseId: number
      sourceNamespace: string
      authentication: SystemReadAuthentication
      session: CompanyPersonnelSession
    }>,
  ) {
    if (!Number.isSafeInteger(input.expenseId))
      return new Error("invalid expense procedure binding")
    const now = this.c.now()
    const authorized = await new PrepareExpenseRecordReadAdapter(this.c).prepare({
      ...input,
      at: now,
    })
    if (authorized instanceof Error) return authorized
    const initial = authorized.assertions(this.c.now())
    if (initial instanceof Error) return initial
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...initial,
        this.c.env.DB.prepare(snapshotSql).bind(input.expenseId),
      ])
      if (reads.length !== initial.length + 1 || reads.some((read) => !read.success))
        return new Error("expense procedure binding is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("expense procedure binding is unavailable")
      const content = new TextEncoder().encode(snapshot)
      const digest = await toSha256Hex(content)
      const recordId = String(input.expenseId)
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "expense",
        recordKind: "expense-procedure-binding",
        recordId,
        formatId: "expense-procedure-binding",
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
          ELSE json_extract('{}','expense_procedure_binding_changed') END`).bind(
          input.expenseId,
          snapshot,
        ),
      ])
      const checked = await this.c.env.DB.batch([...assertions])
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("expense procedure binding changed")
      return Object.freeze({
        source,
        content,
        actorAccountId: input.authentication.accountId,
        sourceAuthorizationRef: Object.freeze({
          context: "expense",
          kind: "expense-procedure-binding",
          id: recordId,
          version: digest,
        }),
        assertions,
      })
    } catch (cause) {
      return new Error("expense procedure binding capture failed", { cause })
    }
  }
}
