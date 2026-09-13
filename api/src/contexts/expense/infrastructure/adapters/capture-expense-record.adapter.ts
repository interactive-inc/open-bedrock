import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { PrepareExpenseRecordReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-record-read.adapter"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"

type Context = CompanyContext & Readonly<{ now: () => Date }>
const snapshotSql = `SELECT json_object(
  'format','expense-record','version',1,
  'record',json_object('id',id,'employee_id',employee_id,'organization_unit_id',organization_unit_id,
    'category',category,'amount',amount,'spent_at',spent_at,'note',note,'status',status,'created_at',created_at)
) AS snapshot_json FROM expenses WHERE id=?1`

/** 申請元行の全列を取得し、表示用の状態や氏名で保存済みの事実を置き換えない。 */
export class CaptureExpenseRecordAdapter {
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
    if (!Number.isSafeInteger(input.expenseId) || input.expenseId < 1)
      return new Error("invalid expense record")
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
        return new Error("expense record is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("expense record is unavailable")
      const content = new TextEncoder().encode(snapshot)
      const digest = await toSha256Hex(content)
      const recordId = String(input.expenseId)
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "expense",
        recordKind: "expense-record",
        recordId,
        formatId: "expense-record",
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
          ELSE json_extract('{}','expense_record_changed') END`).bind(input.expenseId, snapshot),
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
          kind: "expense-record",
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
