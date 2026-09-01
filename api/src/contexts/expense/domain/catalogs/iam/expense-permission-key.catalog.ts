/** Expense が所有する権限key。 */
export const EXPENSE_PERMISSION_KEYS = [
  "budget:manage",
  "budget:read:all",
  "expense:approve",
  "expense:read:all",
] as const

export type ExpensePermissionKey = (typeof EXPENSE_PERMISSION_KEYS)[number]
