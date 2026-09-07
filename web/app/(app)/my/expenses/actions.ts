"use server"

import { toExpenseDecisionTarget } from "@/lib/expense/to-expense-decision-target"
import { cancelExpense } from "@/lib/api/cancel-expense"
import { executeExpense } from "@/lib/api/execute-expense"
import { revalidatePath } from "next/cache"
import { approveExpense } from "@/lib/api/approve-expense"
import { rejectExpense } from "@/lib/api/reject-expense"
import { submitExpense } from "@/lib/api/submit-expense"
import type { ExpenseCategory } from "@/lib/api/types/expense-types"
import { requireAuth } from "@/lib/auth/require-auth"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

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

/** FormData の文字列をカテゴリ enum へ検証付きで変換する。不正なら null。 */
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

/**
 * 経費申請の Server Action。useActionState から呼ばれる。
 * note の空文字は値なし扱いで送らない。
 */
export async function submitExpenseAction(
  previousState: ExpenseSubmitFormState,
  formData: FormData,
): Promise<ExpenseSubmitFormState> {
  await requireAuth()

  const category = toCategory(formData.get("category"))

  if (category === null) {
    return { ok: false, error: "カテゴリを選択してください" }
  }

  const amountValue = formData.get("amount")

  const amount = Number(amountValue)

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, error: "金額は正の整数で入力してください" }
  }

  const spentAtValue = formData.get("spent_at")

  const spentAt = typeof spentAtValue === "string" ? spentAtValue : ""

  if (spentAt === "") {
    return { ok: false, error: "利用日を入力してください" }
  }

  const noteValue = formData.get("note")

  const note = typeof noteValue === "string" && noteValue !== "" ? noteValue : undefined

  const requestKey = formData.get("request_key")
  if (typeof requestKey !== "string" || requestKey.length === 0)
    return { ok: false, error: "提出の識別子がありません。画面を読み直してください" }
  const attachmentIds = formData
    .getAll("attachment_id")
    .filter((id): id is string => typeof id === "string")
  if (attachmentIds.length > 10) return { ok: false, error: "添付は10件までです" }
  const created = await submitExpense({
    request_key: requestKey,
    existing_expense_id: toPositiveIntId(formData.get("existing_expense_id")),
    previous_expense_id: toPositiveIntId(formData.get("previous_expense_id")),
    category: category,
    amount: amount,
    spent_at: spentAt,
    note: note,
    attachment_ids: attachmentIds.length === 0 ? undefined : attachmentIds,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/my/expenses")

  revalidatePath("/inbox/expenses")

  return { ok: true, error: null }
}

/**
 * 経費承認の Server Action。expense_id は hidden フィールドから受け取る。
 * 承認者本人かどうかの判定は api 側の権限判定に委ね、ここでは事前チェックしない。
 */
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

  const target = toExpenseDecisionTarget(formData.get("decision_target"))
  if (target instanceof Error) return { ok: false, error: target.message }
  const decided = await approveExpense(expenseId, comment, target)

  if (decided instanceof Error) {
    return { ok: false, error: decided.message }
  }

  revalidatePath("/inbox/expenses")

  revalidatePath("/my/expenses")

  revalidatePath(`/expense/expenses/${expenseId}`)

  return { ok: true, error: null }
}

/**
 * 経費却下の Server Action。expense_id は hidden フィールドから受け取る。
 * 承認者本人かどうかの判定は api 側の権限判定に委ね、ここでは事前チェックしない。
 */
export async function rejectExpenseAction(
  previousState: ExpenseDecisionFormState,
  formData: FormData,
): Promise<ExpenseDecisionFormState> {
  const expenseId = toPositiveIntId(formData.get("expense_id"))

  if (expenseId === null) {
    return { ok: false, error: "経費が不正です" }
  }

  const commentValue = formData.get("comment")

  const comment = typeof commentValue === "string" && commentValue !== "" ? commentValue : null

  const target = toExpenseDecisionTarget(formData.get("decision_target"))
  if (target instanceof Error) return { ok: false, error: target.message }
  const decided = await rejectExpense(expenseId, comment, target)

  if (decided instanceof Error) {
    return { ok: false, error: decided.message }
  }

  revalidatePath("/inbox/expenses")

  revalidatePath("/my/expenses")

  revalidatePath(`/expense/expenses/${expenseId}`)

  return { ok: true, error: null }
}

/** 表示した経費の取消または承認済み決裁の確定を行う。 */
export async function advanceExpenseAction(
  _previous: ExpenseDecisionFormState,
  formData: FormData,
): Promise<ExpenseDecisionFormState> {
  const id = toPositiveIntId(formData.get("expense_id"))
  const target = toExpenseDecisionTarget(formData.get("decision_target"))
  if (id === null || target instanceof Error)
    return { ok: false, error: "経費の判断対象を確認してください" }
  const operation = formData.get("operation")
  if (operation === "cancel") {
    const result = await cancelExpense(id, target)
    if (result instanceof Error) return { ok: false, error: result.message }
  } else if (operation === "execute") {
    const result = await executeExpense(id, target)
    if (result instanceof Error) return { ok: false, error: result.message }
  } else return { ok: false, error: "経費の操作が不正です" }
  revalidatePath(`/expense/expenses/${id}`)
  revalidatePath("/my/expenses")
  revalidatePath("/inbox/expenses")
  return { ok: true, error: null }
}
