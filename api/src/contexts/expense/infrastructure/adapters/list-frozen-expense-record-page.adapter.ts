import { z } from "zod"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import {
  expenseRecordKindSchema,
  type ExpenseRecordKind,
} from "@/contexts/expense/domain/schemas/expense-record-kind.schema"
import { PrepareExpensePreservationReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-preservation-read.adapter"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

type Context = CompanyContext & Readonly<{ now: () => Date }>
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: expenseRecordKindSchema,
  afterCursor: z.string().min(1).max(512).nullable(),
  limit: z.number().int().min(1).max(100),
})
const rowSchema = z.strictObject({
  record_id: z.string().min(1).max(512),
  expense_id: z.number().int().positive().safe().nullable(),
  attachment_id: z.string().min(1).max(255).nullable(),
})
const sources: Readonly<Record<ExpenseRecordKind, string>> = {
  "expense-record":
    "SELECT CAST(id AS TEXT) AS record_id,id AS expense_id,NULL AS attachment_id FROM expenses",
  "expense-approval":
    "SELECT CAST(id AS TEXT) AS record_id,expense_id,NULL AS attachment_id FROM expense_approvals",
  "expense-procedure-binding":
    "SELECT CAST(expense_id AS TEXT) AS record_id,expense_id,NULL AS attachment_id FROM expense_procedure_bindings",
  "expense-attachment-link":
    "SELECT CAST(expense_id AS TEXT)||':'||attachment_id AS record_id,expense_id,attachment_id FROM expense_attachments",
  "expense-budget":
    "SELECT CAST(id AS TEXT) AS record_id,NULL AS expense_id,NULL AS attachment_id FROM expense_budgets",
  "expense-attachment":
    "SELECT attachment_id AS record_id,MIN(expense_id) AS expense_id,attachment_id FROM expense_attachments GROUP BY attachment_id",
}

/** 同じ停止世代の全保存行を種類ごとに列挙する。IDの一覧だけで保全完了とは判定しない。 */
export class ListFrozenExpenseRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: unknown,
    reader: Readonly<{
      authentication: SystemReadAuthentication
      session: CompanyPersonnelSession
    }>,
  ) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const authorized = await new PrepareExpensePreservationReadAdapter(this.c).prepare({
      ...reader,
      permission: request.recordKind === "expense-budget" ? "budget:manage" : "expense:read:all",
      at: this.c.now(),
    })
    if (authorized instanceof Error) return authorized
    const initial = authorized.assertions(this.c.now())
    if (initial instanceof Error) return initial
    const generation = await new RecordSourceFreezeRepository({
      env: this.c.env,
      assertions: initial,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "expense",
    })
    if (generation instanceof Error) return generation
    const assertions = (now: Date) => {
      const current = authorized.assertions(now)
      return current instanceof Error
        ? current
        : Object.freeze([...current, ...generation.assertions])
    }
    try {
      const guards = assertions(this.c.now())
      if (guards instanceof Error) return guards
      const statements = [
        ...guards,
        this.c.env.DB.prepare(`SELECT record_id,expense_id,attachment_id FROM (${sources[request.recordKind]})
          WHERE ?1 IS NULL OR record_id COLLATE BINARY > ?1
          ORDER BY record_id COLLATE BINARY LIMIT ?2`).bind(request.afterCursor, request.limit + 1),
        ...guards,
      ]
      const reads = await this.c.env.DB.batch(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen expense inventory unavailable")
      const rows = z
        .array(rowSchema)
        .max(request.limit + 1)
        .safeParse(reads[guards.length]?.results)
      if (!rows.success) return rows.error
      const records = rows.data.slice(0, request.limit).map((row) =>
        Object.freeze({
          recordId: row.record_id,
          expenseId: row.expense_id,
          attachmentId: row.attachment_id,
        }),
      )
      const final = assertions(this.c.now())
      if (final instanceof Error) return final
      const checked = await this.c.env.DB.batch([...final])
      if (checked.length !== final.length || checked.some((check) => !check.success))
        return new Error("frozen expense inventory changed")
      return Object.freeze({
        freezeId: request.freezeId,
        recordKind: request.recordKind,
        afterCursor: request.afterCursor,
        records: Object.freeze(records),
        nextCursor: rows.data.length > request.limit ? (records.at(-1)?.recordId ?? null) : null,
        assertions,
      })
    } catch (cause) {
      return new Error("frozen expense inventory unavailable", { cause })
    }
  }
}
