"use server"

import { revalidatePath } from "next/cache"
import { cancelAntisocialCheck } from "@/lib/api/cancel-antisocial-check"
import { createAntisocialCheck } from "@/lib/api/create-antisocial-check"
import { updateAntisocialCheck } from "@/lib/api/update-antisocial-check"
import { getMe } from "@/lib/api/get-me"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type AntisocialCheckActionState = {
  ok: boolean
  error: string | null
}

/**
 * 反社チェック申請作成 Server Action。partner_name 必須、所在地・代表者名は任意。
 * 成功時は /antisocial-checks を revalidate して一覧へ反映する。
 */
export async function createAntisocialCheckAction(
  previousState: AntisocialCheckActionState,
  formData: FormData,
): Promise<AntisocialCheckActionState> {
  const fields = toCreateFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const created = await createAntisocialCheck(fields)

  if (created instanceof Error) {
    return { ok: false, error: "反社チェック申請の作成に失敗しました" }
  }

  revalidatePath("/my/antisocial-checks")

  return { ok: true, error: null }
}

/** 反社チェック申請変更 Server Action。antisocial_check_id 必須。本人以外の変更は api がエラーを返す。 */
export async function updateAntisocialCheckAction(
  previousState: AntisocialCheckActionState,
  formData: FormData,
): Promise<AntisocialCheckActionState> {
  const antisocialCheckId = formData.get("antisocial_check_id")

  if (typeof antisocialCheckId !== "string" || antisocialCheckId === "") {
    return { ok: false, error: "反社チェック申請を特定できませんでした" }
  }

  const fields = toUpdateFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const updated = await updateAntisocialCheck(antisocialCheckId, fields)

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/my/antisocial-checks")

  return { ok: true, error: null }
}

/** 反社チェック申請取消 Server Action。antisocial_check_id 必須。成功時は /antisocial-checks を revalidate する。 */
export async function cancelAntisocialCheckAction(
  previousState: AntisocialCheckActionState,
  formData: FormData,
): Promise<AntisocialCheckActionState> {
  const antisocialCheckId = formData.get("antisocial_check_id")

  if (typeof antisocialCheckId !== "string" || antisocialCheckId === "") {
    return { ok: false, error: "反社チェック申請を特定できませんでした" }
  }

  const cancelled = await cancelAntisocialCheck(antisocialCheckId)

  if (cancelled instanceof Error) {
    return { ok: false, error: cancelled.message }
  }

  revalidatePath("/my/antisocial-checks")

  return { ok: true, error: null }
}

/** 管理者が他者の申請へ判定結果を記録する。本人申請と権限不足は API でも拒否される。 */
export async function completeAntisocialCheckAction(
  previousState: AntisocialCheckActionState,
  formData: FormData,
): Promise<AntisocialCheckActionState> {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    currentUser.permissions.includes("antisocial_check:manage") === false
  ) {
    return { ok: false, error: "反社チェックを判定する権限がありません" }
  }

  const antisocialCheckId = formData.get("antisocial_check_id")

  if (typeof antisocialCheckId !== "string" || antisocialCheckId === "") {
    return { ok: false, error: "反社チェック申請を特定できませんでした" }
  }

  const fields = toUpdateFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  if (fields.result === null) {
    return { ok: false, error: "判定結果を入力してください" }
  }

  const updated = await updateAntisocialCheck(antisocialCheckId, fields)

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/company/inbox/antisocial-checks")
  revalidatePath("/my/antisocial-checks")

  return { ok: true, error: null }
}

type CreateFields = {
  partner_name: string
  partner_address: string | null
  representative_name: string | null
}

type UpdateFields = {
  partner_name: string
  partner_address: string | null
  representative_name: string | null
  result: string | null
}

/** FormData から作成用フィールドを取り出して検証する。不正時は Error。 */
function toCreateFields(formData: FormData): CreateFields | Error {
  const partnerName = formData.get("partner_name")

  if (typeof partnerName !== "string" || partnerName.trim() === "") {
    return new Error("取引先名を入力してください")
  }

  return {
    partner_name: partnerName.trim(),
    partner_address: toOptionalText(formData.get("partner_address")),
    representative_name: toOptionalText(formData.get("representative_name")),
  }
}

/** FormData から変更用フィールドを取り出して検証する。不正時は Error。 */
function toUpdateFields(formData: FormData): UpdateFields | Error {
  const created = toCreateFields(formData)

  if (created instanceof Error) {
    return created
  }

  return {
    partner_name: created.partner_name,
    partner_address: created.partner_address,
    representative_name: created.representative_name,
    result: toOptionalText(formData.get("result")),
  }
}

/** 任意テキストの FormData 値を整える。未入力や不正値は null。 */
function toOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
