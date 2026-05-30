"use server"

import { revalidatePath } from "next/cache"
import { approveExpense } from "@/lib/api/approve-expense"
import { rejectExpense } from "@/lib/api/reject-expense"
import { submitExpense } from "@/lib/api/submit-expense"
import type { ExpenseCategory } from "@/lib/api/types/expense-types"

export type ExpenseSubmitFormState = {
  ok: boolean
  error: string | null
}

export type ExpenseDecisionFormState = {
  ok: boolean
  error: string | null
}

const expenseCategories: ReadonlyArray<ExpenseCategory> = [
  "transport",
  "supplies",
  "entertainment",
  "books",
  "other",
]

// FormData の文字列をカテゴリ enum へ検証付きで変換する。不正なら null。
function toCategory(value: FormDataEntryValue | null): ExpenseCategory | null {
  if (typeof value !== "string") {
    return null
  }

  for (const category of expenseCategories) {
    if (category === value) {
      return category
    }
  }

  return null
}

// 経費申請の Server Action。useActionState から呼ばれる。
// note の空文字は値なし扱いで送らない。
export async function submitExpenseAction(
  previousState: ExpenseSubmitFormState,
  formData: FormData,
): Promise<ExpenseSubmitFormState> {
  const category = toCategory(formData.get("category"))

  if (category === null) {
    return { ok: false, error: "カテゴリを選択してください" }
  }

  const amountValue = formData.get("amount")

  const amount = Number(amountValue)

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "金額は正の数で入力してください" }
  }

  const spentAtValue = formData.get("spent_at")

  const spentAt = typeof spentAtValue === "string" ? spentAtValue : ""

  if (spentAt === "") {
    return { ok: false, error: "利用日を入力してください" }
  }

  const noteValue = formData.get("note")

  const note = typeof noteValue === "string" && noteValue !== "" ? noteValue : undefined

  const created = await submitExpense({
    category: category,
    amount: amount,
    spent_at: spentAt,
    note: note,
  })

  if (created instanceof Error) {
    return { ok: false, error: "経費の申請に失敗しました" }
  }

  revalidatePath("/expense")

  return { ok: true, error: null }
}

// 経費承認の Server Action。expense_id は hidden フィールドから受け取る。
export async function approveExpenseAction(
  previousState: ExpenseDecisionFormState,
  formData: FormData,
): Promise<ExpenseDecisionFormState> {
  const expenseIdValue = formData.get("expense_id")

  const expenseId = Number(expenseIdValue)

  if (!Number.isInteger(expenseId) || expenseId <= 0) {
    return { ok: false, error: "経費が不正です" }
  }

  const commentValue = formData.get("comment")

  const comment = typeof commentValue === "string" && commentValue !== "" ? commentValue : null

  const decided = await approveExpense(expenseId, comment)

  if (decided instanceof Error) {
    return { ok: false, error: "承認に失敗しました" }
  }

  revalidatePath("/expense/inbox")

  revalidatePath(`/expense/${expenseId}`)

  return { ok: true, error: null }
}

// 経費却下の Server Action。理由コメントは必須。
export async function rejectExpenseAction(
  previousState: ExpenseDecisionFormState,
  formData: FormData,
): Promise<ExpenseDecisionFormState> {
  const expenseIdValue = formData.get("expense_id")

  const expenseId = Number(expenseIdValue)

  if (!Number.isInteger(expenseId) || expenseId <= 0) {
    return { ok: false, error: "経費が不正です" }
  }

  const commentValue = formData.get("comment")

  const comment = typeof commentValue === "string" ? commentValue : ""

  if (comment === "") {
    return { ok: false, error: "却下理由を入力してください" }
  }

  const decided = await rejectExpense(expenseId, comment)

  if (decided instanceof Error) {
    return { ok: false, error: "却下に失敗しました" }
  }

  revalidatePath("/expense/inbox")

  revalidatePath(`/expense/${expenseId}`)

  return { ok: true, error: null }
}
