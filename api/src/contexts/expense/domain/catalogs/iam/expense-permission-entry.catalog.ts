import type { ExpensePermissionKey } from "@/contexts/expense/domain/catalogs/iam/expense-permission-key.catalog"

type PermissionEntry = {
  key: ExpensePermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Expense が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const EXPENSE_PERMISSION_ENTRIES = [
  {
    key: "budget:manage",
    category: "budget",
    featureKey: "budgets",
    description: "部署予算を管理する",
  },
  {
    key: "budget:read:all",
    category: "budget",
    featureKey: "budgets",
    description: "予算枠の記録を閲覧する",
  },
  {
    key: "expense:approve",
    category: "expense",
    featureKey: "expenses",
    description: "経費申請を承認・却下する",
  },
  {
    key: "expense:read:all",
    category: "expense",
    featureKey: "expenses",
    description: "全社の経費申請を横断で閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
