"use server"

import { revalidatePath } from "next/cache"
import { approveExpense } from "@/lib/api/approve-expense"
import { deleteExpense } from "@/lib/api/delete-expense"
import { rejectExpense } from "@/lib/api/reject-expense"
import { submitExpense } from "@/lib/api/submit-expense"
import type { ExpenseCategory } from "@/lib/api/types/expense-types"
import { updateExpense } from "@/lib/api/update-expense"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

export type ExpenseSubmitFormState = {
  ok: boolean
  error: string | null
}

export type ExpenseDecisionFormState = {
  ok: boolean
  error: string | null
}

export type ExpenseUpdateFormState = {
  ok: boolean
  error: string | null
}

export type ExpenseDeleteFormState = {
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

  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "金額は正の整数で入力してください" }
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
  const expenseId = toPositiveIntId(formData.get("expense_id"))

  if (expenseId === null) {
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
  const expenseId = toPositiveIntId(formData.get("expense_id"))

  if (expenseId === null) {
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

// 経費変更の Server Action。pending の経費のみ本人が編集できる。
// note の空文字は値なし扱いで null を送る。
export async function updateExpenseAction(
  previousState: ExpenseUpdateFormState,
  formData: FormData,
): Promise<ExpenseUpdateFormState> {
  const expenseId = toPositiveIntId(formData.get("expense_id"))

  if (expenseId === null) {
    return { ok: false, error: "経費が不正です" }
  }

  const category = toCategory(formData.get("category"))

  if (category === null) {
    return { ok: false, error: "カテゴリを選択してください" }
  }

  const amountValue = formData.get("amount")

  const amount = Number(amountValue)

  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "金額は正の整数で入力してください" }
  }

  const spentAtValue = formData.get("spent_at")

  const spentAt = typeof spentAtValue === "string" ? spentAtValue : ""

  if (spentAt === "") {
    return { ok: false, error: "利用日を入力してください" }
  }

  const noteValue = formData.get("note")

  const note = typeof noteValue === "string" && noteValue !== "" ? noteValue : null

  const updated = await updateExpense(expenseId, {
    category: category,
    amount: amount,
    spent_at: spentAt,
    note: note,
  })

  if (updated instanceof Error) {
    return { ok: false, error: "経費の変更に失敗しました" }
  }

  revalidatePath("/expense")

  revalidatePath(`/expense/${expenseId}`)

  return { ok: true, error: null }
}

// 経費取り下げの Server Action。pending の経費のみ本人が取り下げできる。
export async function deleteExpenseAction(
  previousState: ExpenseDeleteFormState,
  formData: FormData,
): Promise<ExpenseDeleteFormState> {
  const expenseId = toPositiveIntId(formData.get("expense_id"))

  if (expenseId === null) {
    return { ok: false, error: "経費が不正です" }
  }

  const deleted = await deleteExpense(expenseId)

  if (deleted instanceof Error) {
    return { ok: false, error: "経費の取り下げに失敗しました" }
  }

  revalidatePath("/expense")

  revalidatePath(`/expense/${expenseId}`)

  return { ok: true, error: null }
}
