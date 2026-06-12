"use server"

import { revalidatePath } from "next/cache"
import { cancelYearEndAdjustment } from "@/lib/api/cancel-year-end-adjustment"
import { createYearEndAdjustment } from "@/lib/api/create-year-end-adjustment"
import { updateYearEndAdjustment } from "@/lib/api/update-year-end-adjustment"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type YearEndAdjustmentActionState = {
  ok: boolean
  error: string | null
}

// 年末調整申告作成 Server Action。target_year 必須、note は任意。
// 成功時は /year-end-adjustments を revalidate して一覧へ反映する。
export async function createYearEndAdjustmentAction(
  previousState: YearEndAdjustmentActionState,
  formData: FormData,
): Promise<YearEndAdjustmentActionState> {
  const fields = toAdjustmentFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const created = await createYearEndAdjustment(fields)

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/year-end-adjustments")

  return { ok: true, error: null }
}

// 年末調整申告変更 Server Action。year_end_adjustment_id 必須。本人以外の変更は api がエラーを返す。
export async function updateYearEndAdjustmentAction(
  previousState: YearEndAdjustmentActionState,
  formData: FormData,
): Promise<YearEndAdjustmentActionState> {
  const yearEndAdjustmentId = formData.get("year_end_adjustment_id")

  if (typeof yearEndAdjustmentId !== "string" || yearEndAdjustmentId === "") {
    return { ok: false, error: "年末調整申告を特定できませんでした" }
  }

  const fields = toAdjustmentFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const updated = await updateYearEndAdjustment(yearEndAdjustmentId, fields)

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/year-end-adjustments")

  return { ok: true, error: null }
}

// 年末調整申告取消 Server Action。year_end_adjustment_id 必須。成功時は /year-end-adjustments を revalidate する。
export async function cancelYearEndAdjustmentAction(
  previousState: YearEndAdjustmentActionState,
  formData: FormData,
): Promise<YearEndAdjustmentActionState> {
  const yearEndAdjustmentId = formData.get("year_end_adjustment_id")

  if (typeof yearEndAdjustmentId !== "string" || yearEndAdjustmentId === "") {
    return { ok: false, error: "年末調整申告を特定できませんでした" }
  }

  const cancelled = await cancelYearEndAdjustment(yearEndAdjustmentId)

  if (cancelled instanceof Error) {
    return { ok: false, error: cancelled.message }
  }

  revalidatePath("/year-end-adjustments")

  return { ok: true, error: null }
}

type AdjustmentFields = {
  target_year: number
  note: string | null
}

// FormData から年末調整申告の共通フィールドを取り出して検証する。不正時は Error。
function toAdjustmentFields(formData: FormData): AdjustmentFields | Error {
  const targetYear = toTargetYear(formData.get("target_year"))

  if (targetYear instanceof Error) {
    return targetYear
  }

  return {
    target_year: targetYear,
    note: toNote(formData.get("note")),
  }
}

// target_year の FormData 値を数値へ。未入力や不正値は Error。
function toTargetYear(value: FormDataEntryValue | null): number | Error {
  if (typeof value !== "string" || value.trim() === "") {
    return new Error("対象年を入力してください")
  }

  const parsed = Number(value)

  if (Number.isInteger(parsed) === false || parsed < 2000) {
    return new Error("対象年を正しく入力してください")
  }

  return parsed
}

// note の FormData 値を文字列へ。未入力は null。
function toNote(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
