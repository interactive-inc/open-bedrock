import { z } from "zod"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { SystemAttachmentStorageContext } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { expenseRecordKindSchema } from "@/contexts/expense/domain/schemas/expense-record-kind.schema"
import { PrepareExpensePreservationReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-preservation-read.adapter"
import { CaptureExpenseRecordAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-record.adapter"
import { CaptureExpenseApprovalRecordAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-approval-record.adapter"
import { CaptureExpenseProcedureBindingAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-procedure-binding.adapter"
import { CaptureExpenseAttachmentLinkAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-attachment-link.adapter"
import { CaptureExpenseBudgetRecordAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-budget-record.adapter"
import { ExpenseAttachmentRecordSourceAdapter } from "@/contexts/expense/infrastructure/adapters/expense-attachment-record-source.adapter"

type Context = CompanyContext & SystemAttachmentStorageContext & Readonly<{ now: () => Date }>
type Reader = Readonly<{
  authentication: SystemReadAuthentication
  session: CompanyPersonnelSession
}>
const targetSchema = z.strictObject({
  recordKind: expenseRecordKindSchema,
  recordId: z.string().min(1).max(512),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
})

/** 種類と正規IDから元記録を取得する。承認行・添付の親は保存済みの対応から解決する。 */
export class CaptureExpenseSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown, reader: Reader) {
    const parsed = targetSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const target = parsed.data
    const access = await new PrepareExpensePreservationReadAdapter(this.c).prepare({
      ...reader,
      at: this.c.now(),
      permission: target.recordKind === "expense-budget" ? "budget:manage" : "expense:read:all",
    })
    if (access instanceof Error) return access
    const guards = access.assertions(this.c.now())
    if (guards instanceof Error) return guards
    try {
      const record = await this.capture(target, reader, guards)
      if (record instanceof Error) return record
      if (
        record.source.props.recordId !== target.recordId ||
        record.source.props.recordKind !== target.recordKind
      )
        return new Error("expense source identifier is not canonical")
      const current = access.assertions(this.c.now())
      if (current instanceof Error) return current
      const assertions = Object.freeze([...current, ...record.assertions])
      const checks = await this.c.env.DB.batch([...assertions])
      if (checks.length !== assertions.length || checks.some((check) => !check.success))
        return new Error("expense source changed")
      return Object.freeze({ ...record, assertions })
    } catch (cause) {
      return new Error("expense source unavailable", { cause })
    }
  }

  private async capture(
    target: z.infer<typeof targetSchema>,
    reader: Reader,
    guards: ReadonlyArray<D1PreparedStatement>,
  ) {
    const input = { ...reader, sourceNamespace: target.sourceNamespace }
    const numericId = Number(target.recordId)
    if (
      target.recordKind !== "expense-attachment" &&
      target.recordKind !== "expense-attachment-link" &&
      (!Number.isSafeInteger(numericId) || numericId < 1 || String(numericId) !== target.recordId)
    )
      return new Error("invalid expense source identifier")
    switch (target.recordKind) {
      case "expense-record":
        return new CaptureExpenseRecordAdapter(this.c).prepare({ ...input, expenseId: numericId })
      case "expense-procedure-binding":
        return new CaptureExpenseProcedureBindingAdapter(this.c).prepare({
          ...input,
          expenseId: numericId,
        })
      case "expense-budget":
        return new CaptureExpenseBudgetRecordAdapter(this.c).prepare({
          ...input,
          budgetId: numericId,
        })
      case "expense-attachment-link": {
        const separator = target.recordId.indexOf(":")
        const parent = target.recordId.slice(0, separator)
        const expenseId = Number(parent)
        if (
          separator < 1 ||
          !Number.isSafeInteger(expenseId) ||
          expenseId < 1 ||
          String(expenseId) !== parent
        )
          return new Error("invalid expense attachment link identifier")
        return new CaptureExpenseAttachmentLinkAdapter(this.c).prepare({
          ...input,
          expenseId,
          attachmentId: target.recordId.slice(separator + 1),
        })
      }
      case "expense-approval":
      case "expense-attachment": {
        const lookup =
          target.recordKind === "expense-approval"
            ? this.c.env.DB.prepare("SELECT expense_id FROM expense_approvals WHERE id=?1").bind(
                numericId,
              )
            : this.c.env.DB.prepare(
                "SELECT MIN(expense_id) AS expense_id FROM expense_attachments WHERE attachment_id=?1",
              ).bind(target.recordId)
        const reads = await this.c.env.DB.batch<{ expense_id: number | null }>([
          ...guards,
          lookup,
          ...guards,
        ])
        if (reads.length !== guards.length * 2 + 1 || reads.some((read) => !read.success))
          return new Error("expense source parent unavailable")
        const id = z
          .number()
          .int()
          .positive()
          .safe()
          .safeParse(reads[guards.length]?.results.at(0)?.expense_id)
        if (!id.success) return new Error("expense source parent missing")
        return target.recordKind === "expense-approval"
          ? new CaptureExpenseApprovalRecordAdapter(this.c).prepare({
              ...input,
              expenseId: id.data,
              approvalId: numericId,
            })
          : new ExpenseAttachmentRecordSourceAdapter(this.c).capture({
              ...input,
              expenseId: id.data,
              attachmentId: target.recordId,
            })
      }
    }
  }
}
