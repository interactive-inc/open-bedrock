"use server"

import { revalidatePath } from "next/cache"
import { createHeadcountPlan } from "@/lib/api/create-headcount-plan"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type HeadcountPlanActionState = {
  ok: boolean
  error: string | null
}

/** 人員計画の作成 Server Action。fiscal_year/planned_count 必須。headcount_plan:manage が無いと api が 403。 */
export async function createHeadcountPlanAction(
  previousState: HeadcountPlanActionState,
  formData: FormData,
): Promise<HeadcountPlanActionState> {
  const fiscalYear = toInt(formData.get("fiscal_year"))

  const plannedCount = toNonNegativeInt(formData.get("planned_count"))

  if (fiscalYear === null || plannedCount === null) {
    return { ok: false, error: "年度と計画人数を入力してください" }
  }

  const created = await createHeadcountPlan({
    fiscal_year: fiscalYear,
    department_code: toText(formData.get("department_code")),
    planned_count: plannedCount,
    note: toText(formData.get("note")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/headcount-plan/headcount-plans")

  return { ok: true, error: null }
}

/** FormData 値を文字列へ。未入力や空白のみは null。 */
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

/** FormData 値を整数へ。不正値は null。 */
function toInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  const parsed = Number.parseInt(value, 10)

  return Number.isInteger(parsed) ? parsed : null
}

/** FormData 値を 0 以上の整数へ。不正値は null。 */
function toNonNegativeInt(value: FormDataEntryValue | null): number | null {
  const parsed = toInt(value)

  if (parsed === null || parsed < 0) {
    return null
  }

  return parsed
}
