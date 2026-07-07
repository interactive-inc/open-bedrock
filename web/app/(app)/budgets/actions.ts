"use server"

import { revalidatePath } from "next/cache"
import { createBudget } from "@/lib/api/create-budget"
import { recordBudgetConsumption } from "@/lib/api/record-budget-consumption"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type BudgetActionState = {
  ok: boolean
  error: string | null
}

// 予算枠の作成 Server Action。budget:manage が無いと api が 403。
export async function createBudgetAction(
  previousState: BudgetActionState,
  formData: FormData,
): Promise<BudgetActionState> {
  const fiscalYear = toInteger(formData.get("fiscal_year"))

  const title = toText(formData.get("title"))

  const amount = toInteger(formData.get("amount"))

  if (fiscalYear === null || title === null || amount === null) {
    return { ok: false, error: "会計年度・表題・金額を入力してください" }
  }

  const created = await createBudget({
    fiscal_year: fiscalYear,
    title: title,
    amount: amount,
    department_code: toText(formData.get("department_code")),
    note: toText(formData.get("note")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/budgets")

  return { ok: true, error: null }
}

// 予算枠の消化記録 Server Action。form の hidden input で budget id を渡す。budget:manage が無いと api が 403。
export async function recordBudgetConsumptionAction(
  previousState: BudgetActionState,
  formData: FormData,
): Promise<BudgetActionState> {
  const budgetId = toInteger(formData.get("budget_id"))

  const amount = toInteger(formData.get("amount"))

  const recordedOn = toText(formData.get("recorded_on"))

  if (budgetId === null || amount === null || recordedOn === null) {
    return { ok: false, error: "金額と記録日を入力してください" }
  }

  const recorded = await recordBudgetConsumption(budgetId, {
    amount: amount,
    recorded_on: recordedOn,
    note: toText(formData.get("note")),
  })

  if (recorded instanceof Error) {
    return { ok: false, error: recorded.message }
  }

  revalidatePath("/budgets")

  return { ok: true, error: null }
}

// FormData 値を文字列へ。未入力や空白のみは null。
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

// FormData 値を整数へ。未入力や不正は null。
function toInteger(value: FormDataEntryValue | null): number | null {
  const text = toText(value)

  if (text === null) {
    return null
  }

  const parsed = Number(text)

  return Number.isInteger(parsed) ? parsed : null
}
