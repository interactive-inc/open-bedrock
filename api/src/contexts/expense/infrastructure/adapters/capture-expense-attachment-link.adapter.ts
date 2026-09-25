import { z } from "zod"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { PrepareExpenseAttachmentReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-attachment-read.adapter"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"

type Context = CompanyContext & Readonly<{ now: () => Date }>
const snapshotSql = `SELECT json_object(
  'format','expense-attachment-link','version',2,
  'record',json_object('id',id,'expense_id',expense_id,'attachment_id',attachment_id,'created_at',created_at)
) AS snapshot_json FROM expense_attachments WHERE expense_id=?1 AND attachment_id=?2`

/** 同じ添付を使う各申請との対応を、ファイル本体と別の記録として取得する。 */
export class CaptureExpenseAttachmentLinkAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      expenseId: string
      attachmentId: string
      sourceNamespace: string
      authentication: SystemReadAuthentication
      session: CompanyPersonnelSession
    }>,
  ) {
    if (!z.uuid().safeParse(input.expenseId).success)
      return new Error("invalid expense attachment link")
    const now = this.c.now()
    const authorized = await new PrepareExpenseAttachmentReadAdapter(this.c).prepare({
      ...input,
      at: now,
    })
    if (authorized instanceof Error) return authorized
    const initial = authorized.assertions(this.c.now())
    if (initial instanceof Error) return initial
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...initial,
        this.c.env.DB.prepare(snapshotSql).bind(input.expenseId, input.attachmentId),
      ])
      if (reads.length !== initial.length + 1 || reads.some((read) => !read.success))
        return new Error("expense attachment link is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("expense attachment link is unavailable")
      const content = new TextEncoder().encode(snapshot)
      const digest = await toSha256Hex(content)
      const recordId = `${input.expenseId}:${input.attachmentId}`
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "expense",
        recordKind: "expense-attachment-link",
        recordId,
        formatId: "expense-attachment-link",
        formatVersion: 2,
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
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?3 THEN 1
          ELSE json_extract('{}','expense_attachment_link_changed') END`).bind(
          input.expenseId,
          input.attachmentId,
          snapshot,
        ),
      ])
      const checked = await this.c.env.DB.batch([...assertions])
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("expense attachment link changed")
      return Object.freeze({
        source,
        content,
        actorAccountId: input.authentication.accountId,
        sourceAuthorizationRef: Object.freeze({
          context: "expense",
          kind: "expense-attachment-link",
          id: recordId,
          version: digest,
        }),
        assertions,
      })
    } catch (cause) {
      return new Error("expense attachment link capture failed", { cause })
    }
  }
}
