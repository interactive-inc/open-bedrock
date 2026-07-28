"use server"

import { revalidatePath } from "next/cache"
import { acceptResignation } from "@/lib/api/accept-resignation"
import { cancelResignation } from "@/lib/api/cancel-resignation"
import { createResignation } from "@/lib/api/create-resignation"
import { getMe } from "@/lib/api/get-me"
import { rejectResignation } from "@/lib/api/reject-resignation"
import { updateResignation } from "@/lib/api/update-resignation"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"
import { toOptionalIsoDate } from "@/lib/form/to-optional-iso-date"
import { toOptionalText } from "@/lib/form/to-optional-text"
import { toRequiredIsoDate } from "@/lib/form/to-required-iso-date"
import { canManageResignations } from "@/lib/resignation/can-manage-resignations"
import { requireAuth } from "@/lib/auth/require-auth"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type ResignationActionState = {
  ok: boolean
  error: string | null
}

/**
 * 人事が退職申請を受理する Server Action。resignation_id 必須。
 * permission を確認してから API を叩き、成功時は admin 一覧を revalidate する。
 */
export async function acceptResignationAction(
  previousState: ResignationActionState,
  formData: FormData,
): Promise<ResignationActionState> {
  const id = toResignationIdText(formData.get("resignation_id"))

  if (id === null) {
    return { ok: false, error: "申請を特定できませんでした" }
  }

  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageResignations(currentUser.permissions) === false) {
    return { ok: false, error: "退職申請を管理する権限がありません" }
  }

  const accepted = await acceptResignation(id)

  if (accepted instanceof Error) {
    return { ok: false, error: accepted.message }
  }

  revalidatePath("/organization/resignations")

  return { ok: true, error: null }
}

/**
 * 人事が退職申請を却下する Server Action。resignation_id 必須。
 * permission を確認してから API を叩き、成功時は admin 一覧を revalidate する。
 */
export async function rejectResignationAction(
  previousState: ResignationActionState,
  formData: FormData,
): Promise<ResignationActionState> {
  const id = toResignationIdText(formData.get("resignation_id"))

  if (id === null) {
    return { ok: false, error: "申請を特定できませんでした" }
  }

  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageResignations(currentUser.permissions) === false) {
    return { ok: false, error: "退職申請を管理する権限がありません" }
  }

  const rejected = await rejectResignation(id)

  if (rejected instanceof Error) {
    return { ok: false, error: rejected.message }
  }

  revalidatePath("/organization/resignations")

  return { ok: true, error: null }
}

/** id 用の FormData 値を取り出す。未入力は null。 */
function toResignationIdText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

/**
 * 退職申請作成 Server Action。resignation_date 必須、last_working_date と reason は任意。
 * 成功時は /resignations を revalidate して一覧へ反映する。
 */
export async function createResignationAction(
  previousState: ResignationActionState,
  formData: FormData,
): Promise<ResignationActionState> {
  await requireAuth()

  const fields = toResignationFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const created = await createResignation(fields)

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/my/resignations")

  return { ok: true, error: null }
}

/** 退職申請変更 Server Action。resignation_id 必須。本人以外の変更は api がエラーを返す。 */
export async function updateResignationAction(
  previousState: ResignationActionState,
  formData: FormData,
): Promise<ResignationActionState> {
  await requireAuth()

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
    return { ok: false, error: updated.message }
  }

  revalidatePath("/my/resignations")

  return { ok: true, error: null }
}

/** 退職申請取消 Server Action。resignation_id 必須。成功時は /resignations を revalidate する。 */
export async function cancelResignationAction(
  previousState: ResignationActionState,
  formData: FormData,
): Promise<ResignationActionState> {
  await requireAuth()

  const resignationId = formData.get("resignation_id")

  if (typeof resignationId !== "string" || resignationId === "") {
    return { ok: false, error: "退職申請を特定できませんでした" }
  }

  const cancelled = await cancelResignation(resignationId)

  if (cancelled instanceof Error) {
    return { ok: false, error: cancelled.message }
  }

  revalidatePath("/my/resignations")

  return { ok: true, error: null }
}

type ResignationFields = {
  resignation_date: string
  last_working_date: string | null
  reason: string | null
}

/** FormData から退職申請の共通フィールドを取り出して検証する。不正時は Error。 */
function toResignationFields(formData: FormData): ResignationFields | Error {
  const resignationDate = toRequiredIsoDate(formData.get("resignation_date"), "退職希望日")

  if (resignationDate instanceof Error) {
    return resignationDate
  }

  const last = toOptionalIsoDate(formData.get("last_working_date"), "最終出社日")

  if (last instanceof Error) {
    return last
  }

  if (last !== null && last > resignationDate) {
    return new Error("最終出社日は退職希望日以前にしてください")
  }

  const reason = toOptionalText(formData.get("reason"), {
    label: "理由",
    max: FORM_CONSTRAINTS.resignation.reasonMax,
  })

  if (reason instanceof Error) {
    return reason
  }

  return {
    resignation_date: resignationDate,
    last_working_date: last,
    reason: reason,
  }
}
