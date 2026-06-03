"use server"

import { revalidatePath } from "next/cache"
import { cancelFamilyCareLeave } from "@/lib/api/cancel-family-care-leave"
import { createFamilyCareLeave } from "@/lib/api/create-family-care-leave"
import { updateFamilyCareLeave } from "@/lib/api/update-family-care-leave"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type FamilyCareLeaveActionState = {
  ok: boolean
  error: string | null
}

// 休業申出作成 Server Action。leave_kind/start_date/end_date 必須、note は任意。
// 成功時は /family-care-leaves を revalidate して一覧へ反映する。
export async function createFamilyCareLeaveAction(
  previousState: FamilyCareLeaveActionState,
  formData: FormData,
): Promise<FamilyCareLeaveActionState> {
  const fields = toLeaveFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const created = await createFamilyCareLeave(fields)

  if (created instanceof Error) {
    return { ok: false, error: "休業申出の作成に失敗しました" }
  }

  revalidatePath("/family-care-leaves")

  return { ok: true, error: null }
}

// 休業申出変更 Server Action。family_care_leave_id 必須。本人以外の変更は api がエラーを返す。
export async function updateFamilyCareLeaveAction(
  previousState: FamilyCareLeaveActionState,
  formData: FormData,
): Promise<FamilyCareLeaveActionState> {
  const familyCareLeaveId = formData.get("family_care_leave_id")

  if (typeof familyCareLeaveId !== "string" || familyCareLeaveId === "") {
    return { ok: false, error: "休業申出を特定できませんでした" }
  }

  const fields = toLeaveFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const updated = await updateFamilyCareLeave(familyCareLeaveId, fields)

  if (updated instanceof Error) {
    return { ok: false, error: "休業申出の変更に失敗しました" }
  }

  revalidatePath("/family-care-leaves")

  return { ok: true, error: null }
}

// 休業申出取消 Server Action。family_care_leave_id 必須。成功時は /family-care-leaves を revalidate する。
export async function cancelFamilyCareLeaveAction(
  previousState: FamilyCareLeaveActionState,
  formData: FormData,
): Promise<FamilyCareLeaveActionState> {
  const familyCareLeaveId = formData.get("family_care_leave_id")

  if (typeof familyCareLeaveId !== "string" || familyCareLeaveId === "") {
    return { ok: false, error: "休業申出を特定できませんでした" }
  }

  const cancelled = await cancelFamilyCareLeave(familyCareLeaveId)

  if (cancelled instanceof Error) {
    return { ok: false, error: "休業申出の取消に失敗しました" }
  }

  revalidatePath("/family-care-leaves")

  return { ok: true, error: null }
}

type LeaveFields = {
  leave_kind: string
  start_date: string
  end_date: string
  note: string | null
}

// FormData から休業申出の共通フィールドを取り出して検証する。不正時は Error。
function toLeaveFields(formData: FormData): LeaveFields | Error {
  const leaveKind = formData.get("leave_kind")

  const startDate = formData.get("start_date")

  const endDate = formData.get("end_date")

  if (typeof leaveKind !== "string" || leaveKind.trim() === "") {
    return new Error("種別を選んでください")
  }

  if (typeof startDate !== "string" || startDate === "") {
    return new Error("開始日を入力してください")
  }

  if (typeof endDate !== "string" || endDate === "") {
    return new Error("終了予定日を入力してください")
  }

  if (endDate < startDate) {
    return new Error("終了予定日は開始日以降にしてください")
  }

  return {
    leave_kind: leaveKind.trim(),
    start_date: startDate,
    end_date: endDate,
    note: toNote(formData.get("note")),
  }
}

// note の FormData 値を取り出す。未入力は null。
function toNote(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
