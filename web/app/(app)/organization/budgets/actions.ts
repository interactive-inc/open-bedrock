"use server"

import { revalidatePath } from "next/cache"
import { createBudget } from "@/lib/api/create-budget"
import { deleteBudget } from "@/lib/api/delete-budget"
import { getMe } from "@/lib/api/get-me"
import { updateBudget } from "@/lib/api/update-budget"
import { canManageBudgets } from "@/lib/budget/can-manage-budgets"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

export type BudgetCreateFormState = {
  ok: boolean
  error: string | null
}

export type BudgetUpdateFormState = {
  ok: boolean
  error: string | null
}

export type BudgetDeleteFormState = {
  ok: boolean
  error: string | null
}

/** FormData の値を正の整数に検証付きで変換する。不正なら null。 */
function toPositiveInt(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

/** FormData の文字列を取り出す。文字列でなければ空文字。 */
function toText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : ""
}

/** 予算登録の Server Action。budget:manage を持つロールのみ。 */
export async function createBudgetAction(
  previousState: BudgetCreateFormState,
  formData: FormData,
): Promise<BudgetCreateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageBudgets(currentUser.permissions) === false) {
    return { ok: false, error: "予算を管理する権限がありません" }
  }

  const departmentId = toPositiveInt(formData.get("department_id"))

  if (departmentId === null) {
    return { ok: false, error: "部署 ID は正の整数で入力してください" }
  }

  const fiscalPeriod = toText(formData.get("fiscal_period"))

  if (fiscalPeriod === "") {
    return { ok: false, error: "会計期間を入力してください" }
  }

  const periodStart = toText(formData.get("period_start"))

  const periodEnd = toText(formData.get("period_end"))

  if (periodStart === "" || periodEnd === "") {
    return { ok: false, error: "期間の開始日と終了日を入力してください" }
  }

  if (periodEnd < periodStart) {
    return { ok: false, error: "終了日は開始日以降を指定してください" }
  }

  const amount = toPositiveInt(formData.get("amount"))

  if (amount === null) {
    return { ok: false, error: "金額は正の整数で入力してください" }
  }

  const name = toText(formData.get("name"))

  if (name === "") {
    return { ok: false, error: "名称を入力してください" }
  }

  const noteValue = formData.get("note")

  const note = typeof noteValue === "string" && noteValue !== "" ? noteValue : undefined

  const created = await createBudget({
    department_id: departmentId,
    fiscal_period: fiscalPeriod,
    period_start: periodStart,
    period_end: periodEnd,
    amount: amount,
    name: name,
    note: note,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/organization/budgets")

  return { ok: true, error: null }
}

/** 予算変更の Server Action。金額・名称・メモのみ変更できる。budget:manage を持つロールのみ。 */
export async function updateBudgetAction(
  previousState: BudgetUpdateFormState,
  formData: FormData,
): Promise<BudgetUpdateFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageBudgets(currentUser.permissions) === false) {
    return { ok: false, error: "予算を管理する権限がありません" }
  }

  const budgetId = toPositiveIntId(formData.get("budget_id"))

  if (budgetId === null) {
    return { ok: false, error: "予算が不正です" }
  }

  const amount = toPositiveInt(formData.get("amount"))

  if (amount === null) {
    return { ok: false, error: "金額は正の整数で入力してください" }
  }

  const name = toText(formData.get("name"))

  if (name === "") {
    return { ok: false, error: "名称を入力してください" }
  }

  const noteValue = formData.get("note")

  const note = typeof noteValue === "string" && noteValue !== "" ? noteValue : null

  const updated = await updateBudget(budgetId, {
    amount: amount,
    name: name,
    note: note,
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/organization/budgets")

  revalidatePath(`/organization/budgets/${budgetId}`)

  return { ok: true, error: null }
}

/**
 * 予算削除の Server Action。budget:manage を持つロールのみ。
 * 削除後は詳細ページが消えるため一覧へ遷移する。redirect は内部で throw するので最後に呼ぶ。
 */
export async function deleteBudgetAction(
  previousState: BudgetDeleteFormState,
  formData: FormData,
): Promise<BudgetDeleteFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageBudgets(currentUser.permissions) === false) {
    return { ok: false, error: "予算を管理する権限がありません" }
  }

  const budgetId = toPositiveIntId(formData.get("budget_id"))

  if (budgetId === null) {
    return { ok: false, error: "予算が不正です" }
  }

  const deleted = await deleteBudget(budgetId)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/organization/budgets")

  // redirect() せず ok:true を返す。クライアント側で遷移を処理し、
  // 成功フィードバック（toast等）が握り潰されるのを防ぐ。
  return { ok: true, error: null }
}
