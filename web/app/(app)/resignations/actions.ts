"use server"

import { revalidatePath } from "next/cache"
import { cancelResignation } from "@/lib/api/cancel-resignation"
import { createResignation } from "@/lib/api/create-resignation"
import { updateResignation } from "@/lib/api/update-resignation"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type ResignationActionState = {
  ok: boolean
  error: string | null
}

// 退職申請作成 Server Action。resignation_date 必須、last_working_date と reason は任意。
// 成功時は /resignations を revalidate して一覧へ反映する。
export async function createResignationAction(
  previousState: ResignationActionState,
  formData: FormData,
): Promise<ResignationActionState> {
  const fields = toResignationFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const created = await createResignation(fields)

  if (created instanceof Error) {
    return { ok: false, error: "退職申請の作成に失敗しました" }
  }

  revalidatePath("/resignations")

  return { ok: true, error: null }
}

// 退職申請変更 Server Action。resignation_id 必須。本人以外の変更は api がエラーを返す。
export async function updateResignationAction(
  previousState: ResignationActionState,
  formData: FormData,
): Promise<ResignationActionState> {
  const resignationId = formData.get("resignation_id")

  if (typeof resignationId !== "string" || resignationId === "") {
    return { ok: false, error: "退職申請を特定できませんでした" }
  }

  const fields = toResignationFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const updated = await updateResignation(resignationId, fields)

  if (updated instanceof Error) {
    return { ok: false, error: "退職申請の変更に失敗しました" }
  }

  revalidatePath("/resignations")

  return { ok: true, error: null }
}

// 退職申請取消 Server Action。resignation_id 必須。成功時は /resignations を revalidate する。
export async function cancelResignationAction(
  previousState: ResignationActionState,
  formData: FormData,
): Promise<ResignationActionState> {
  const resignationId = formData.get("resignation_id")

  if (typeof resignationId !== "string" || resignationId === "") {
    return { ok: false, error: "退職申請を特定できませんでした" }
  }

  const cancelled = await cancelResignation(resignationId)

  if (cancelled instanceof Error) {
    return { ok: false, error: "退職申請の取消に失敗しました" }
  }

  revalidatePath("/resignations")

  return { ok: true, error: null }
}

type ResignationFields = {
  resignation_date: string
  last_working_date: string | null
  reason: string | null
}

// FormData から退職申請の共通フィールドを取り出して検証する。不正時は Error。
function toResignationFields(formData: FormData): ResignationFields | Error {
  const resignationDate = formData.get("resignation_date")

  const lastWorkingDate = formData.get("last_working_date")

  const reason = formData.get("reason")

  if (typeof resignationDate !== "string" || resignationDate === "") {
    return new Error("退職希望日を入力してください")
  }

  const last = toOptionalText(lastWorkingDate)

  if (last !== null && last > resignationDate) {
    return new Error("最終出社日は退職希望日以前にしてください")
  }

  return {
    resignation_date: resignationDate,
    last_working_date: last,
    reason: toOptionalText(reason),
  }
}

// 任意テキストの FormData 値を取り出す。未入力や空文字は null。
function toOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
