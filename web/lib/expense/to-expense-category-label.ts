import type { ExpenseCategory } from "@/lib/api/types/expense-types"

/** 経費カテゴリの enum 値を画面表示用の日本語ラベルへ変換する。 */
export function toExpenseCategoryLabel(category: ExpenseCategory): string {
  if (category === "transport") {
    return "交通費"
  }

  if (category === "supplies") {
    return "備品"
  }

  if (category === "entertainment") {
    return "交際費"
  }

  if (category === "books") {
    return "書籍"
  }

  return "その他"
}
