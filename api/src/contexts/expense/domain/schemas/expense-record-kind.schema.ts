import { z } from "zod"

/** 経費を撤去する前に照合する元記録の種類。添付対応とファイル本体を区別する。 */
export const expenseRecordKindSchema = z.enum([
  "expense-record",
  "expense-approval",
  "expense-procedure-binding",
  "expense-attachment-link",
  "expense-budget",
  "expense-attachment",
])

export type ExpenseRecordKind = z.infer<typeof expenseRecordKindSchema>
