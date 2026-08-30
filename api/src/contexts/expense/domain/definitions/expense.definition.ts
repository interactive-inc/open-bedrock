import { z } from "zod"

export const expenseCategorySchema = z.enum([
  "transport",
  "supplies",
  "entertainment",
  "books",
  "other",
])

export type ExpenseCategory = z.infer<typeof expenseCategorySchema>

export const expenseStatusSchema = z.enum(["pending", "approved", "rejected", "settled"])

export type ExpenseStatus = z.infer<typeof expenseStatusSchema>

export const expenseApprovalActionSchema = z.enum(["approve", "reject"])

export type ExpenseApprovalAction = z.infer<typeof expenseApprovalActionSchema>
