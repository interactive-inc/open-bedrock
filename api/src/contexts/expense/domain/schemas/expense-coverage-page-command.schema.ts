import { expenseRecordKindSchema } from "@/contexts/expense/domain/schemas/expense-record-kind.schema"
import { z } from "zod"

export const expenseCoveragePageCommandSchema = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  recordKind: expenseRecordKindSchema,
  purpose: z.string().trim().min(1).max(255),
  records: z
    .array(
      z.strictObject({
        sourceRecordId: z.string().min(1).max(512),
        preservedRecordId: z.uuid(),
      }),
    )
    .max(10),
})
