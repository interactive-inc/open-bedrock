"use server"

import { revalidatePath } from "next/cache"
import { approveFamilyCareLeave } from "@/lib/api/approve-family-care-leave"
import { cancelFamilyCareLeave } from "@/lib/api/cancel-family-care-leave"
import { cancelFamilyCareLeaveApproval } from "@/lib/api/cancel-family-care-leave-approval"
import { createFamilyCareLeave } from "@/lib/api/create-family-care-leave"
import { getMe } from "@/lib/api/get-me"
import { updateFamilyCareLeave } from "@/lib/api/update-family-care-leave"
import { canManageFamilyCareLeaves } from "@/lib/family-care-leave/can-manage-family-care-leaves"
import {
  FORM_CONSTRAINTS,
  toOptionalText,
  toRequiredIsoDate,
  toRequiredText,
} from "@/lib/form/constraints"
import { requireAuth } from "@/lib/auth/require-auth"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type FamilyCareLeaveActionState = {
  ok: boolean
  error: string | null
}

/**
 * 人事が休業申出を承認する Server Action。family_care_leave_id 必須。
 * permission を確認してから API を叩き、成功時は admin 一覧を revalidate する。
 */
export async function approveFamilyCareLeaveAction(
  previousState: FamilyCareLeaveActionState,
  formData: FormData,
): Promise<FamilyCareLeaveActionState> {
  const id = toFamilyCareLeaveIdText(formData.get("family_care_leave_id"))

  if (id === null) {
    return { ok: false, error: "申出を特定できませんでした" }
  }

  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    canManageFamilyCareLeaves(currentUser.permissions) === false
  ) {
    return { ok: false, error: "休業申出を管理する権限がありません" }
  }

  const approved = await approveFamilyCareLeave(id)

  if (approved instanceof Error) {
    return { ok: false, error: approved.message }
  }

  revalidatePath("/organization/family-care-leaves")

  return { ok: true, error: null }
}

/**
 * 人事が休業申出を取消にする Server Action。family_care_leave_id 必須。
 * permission を確認してから API を叩き、成功時は admin 一覧を revalidate する。
 */
export async function cancelFamilyCareLeaveApprovalAction(
  previousState: FamilyCareLeaveActionState,
  formData: FormData,
): Promise<FamilyCareLeaveActionState> {
  const id = toFamilyCareLeaveIdText(formData.get("family_care_leave_id"))

  if (id === null) {
    return { ok: false, error: "申出を特定できませんでした" }
  }

  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    canManageFamilyCareLeaves(currentUser.permissions) === false
  ) {
    return { ok: false, error: "休業申出を管理する権限がありません" }
  }

  const cancelled = await cancelFamilyCareLeaveApproval(id)

  if (cancelled instanceof Error) {
    return { ok: false, error: cancelled.message }
  }

  revalidatePath("/organization/family-care-leaves")

  return { ok: true, error: null }
}

/** id 用の FormData 値を取り出す。未入力は null。 */
function toFamilyCareLeaveIdText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

/**
 * 休業申出作成 Server Action。leave_kind/start_date/end_date 必須、note は任意。
 * 成功時は /family-care-leaves を revalidate して一覧へ反映する。
 */
export async function createFamilyCareLeaveAction(
  previousState: FamilyCareLeaveActionState,
  formData: FormData,
): Promise<FamilyCareLeaveActionState> {
  await requireAuth()

  const fields = toLeaveFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const created = await createFamilyCareLeave(fields)

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/my/family-care-leaves")

  return { ok: true, error: null }
}

/** 休業申出変更 Server Action。family_care_leave_id 必須。本人以外の変更は api がエラーを返す。 */
export async function updateFamilyCareLeaveAction(
  previousState: FamilyCareLeaveActionState,
  formData: FormData,
): Promise<FamilyCareLeaveActionState> {
  await requireAuth()

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
    return { ok: false, error: updated.message }
  }

  revalidatePath("/my/family-care-leaves")

  return { ok: true, error: null }
}

/** 休業申出取消 Server Action。family_care_leave_id 必須。成功時は /family-care-leaves を revalidate する。 */
export async function cancelFamilyCareLeaveAction(
  previousState: FamilyCareLeaveActionState,
  formData: FormData,
): Promise<FamilyCareLeaveActionState> {
  await requireAuth()

  const familyCareLeaveId = formData.get("family_care_leave_id")

  if (typeof familyCareLeaveId !== "string" || familyCareLeaveId === "") {
    return { ok: false, error: "休業申出を特定できませんでした" }
  }

  const cancelled = await cancelFamilyCareLeave(familyCareLeaveId)

  if (cancelled instanceof Error) {
    return { ok: false, error: cancelled.message }
  }

  revalidatePath("/my/family-care-leaves")

  return { ok: true, error: null }
}

type LeaveFields = {
  leave_kind: string
  start_date: string
  end_date: string
  note: string | null
}

/** FormData から休業申出の共通フィールドを取り出して検証する。不正時は Error。 */
function toLeaveFields(formData: FormData): LeaveFields | Error {
  const leaveKind = toRequiredText(formData.get("leave_kind"), {
    label: "種別",
    max: FORM_CONSTRAINTS.familyCareLeave.leaveKindMax,
  })

  if (leaveKind instanceof Error) {
    return leaveKind
  }

  const startDate = toRequiredIsoDate(formData.get("start_date"), "開始日")

  if (startDate instanceof Error) {
    return startDate
  }

  const endDate = toRequiredIsoDate(formData.get("end_date"), "終了予定日")

  if (endDate instanceof Error) {
    return endDate
  }

  if (endDate < startDate) {
    return new Error("終了予定日は開始日以降にしてください")
  }

  const note = toOptionalText(formData.get("note"), {
    label: "備考",
    max: FORM_CONSTRAINTS.familyCareLeave.noteMax,
  })

  if (note instanceof Error) {
    return note
  }

  return {
    leave_kind: leaveKind,
    start_date: startDate,
    end_date: endDate,
    note: note,
  }
}
