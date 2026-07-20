"use server"

import { revalidatePath } from "next/cache"
import { createOneOnOne } from "@/lib/api/create-oneonone"
import { deleteOneOnOne } from "@/lib/api/delete-oneonone"
import { updateOneOnOne } from "@/lib/api/update-oneonone"
import { FORM_CONSTRAINTS, toOptionalText, toRequiredText } from "@/lib/form/constraints"
import { requireAuth } from "@/lib/auth/require-auth"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type OneOnOneActionState = {
  ok: boolean
  error: string | null
}

/**
 * 1on1 記録作成 Server Action。member_employee_code 必須、topics/manager_note/next_action は任意。
 * 成功時は /oneonone を revalidate して履歴へ反映する。
 */
export async function createOneOnOneAction(
  previousState: OneOnOneActionState,
  formData: FormData,
): Promise<OneOnOneActionState> {
  await requireAuth()

  const memberCode = toRequiredText(formData.get("member_employee_code"), {
    label: "メンバー",
    max: 20,
  })

  if (memberCode instanceof Error) {
    return { ok: false, error: memberCode.message }
  }

  const topics = toOneOnOneText(formData.get("topics"), "トピック")

  if (topics instanceof Error) {
    return { ok: false, error: topics.message }
  }

  const managerNote = toOneOnOneText(formData.get("manager_note"), "上長メモ")

  if (managerNote instanceof Error) {
    return { ok: false, error: managerNote.message }
  }

  const nextAction = toOneOnOneText(formData.get("next_action"), "ネクストアクション")

  if (nextAction instanceof Error) {
    return { ok: false, error: nextAction.message }
  }

  const created = await createOneOnOne({
    member_employee_code: memberCode,
    topics,
    manager_note: managerNote,
    next_action: nextAction,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/my/oneonones")

  return { ok: true, error: null }
}

/**
 * 1on1 記録変更 Server Action。one_on_one_id 必須、topics/manager_note/next_action は任意。
 * 記録した上長以外の変更は api がエラーを返す。成功時は /oneonone を revalidate する。
 */
export async function updateOneOnOneAction(
  previousState: OneOnOneActionState,
  formData: FormData,
): Promise<OneOnOneActionState> {
  await requireAuth()

  const oneOnOneId = formData.get("one_on_one_id")

  if (typeof oneOnOneId !== "string" || oneOnOneId === "") {
    return { ok: false, error: "1on1 を特定できませんでした" }
  }

  const topics = toOneOnOneText(formData.get("topics"), "トピック")

  if (topics instanceof Error) {
    return { ok: false, error: topics.message }
  }

  const managerNote = toOneOnOneText(formData.get("manager_note"), "上長メモ")

  if (managerNote instanceof Error) {
    return { ok: false, error: managerNote.message }
  }

  const nextAction = toOneOnOneText(formData.get("next_action"), "ネクストアクション")

  if (nextAction instanceof Error) {
    return { ok: false, error: nextAction.message }
  }

  const updated = await updateOneOnOne(oneOnOneId, {
    topics,
    manager_note: managerNote,
    next_action: nextAction,
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/my/oneonones")

  return { ok: true, error: null }
}

/**
 * 1on1 記録削除 Server Action。one_on_one_id 必須。
 * 記録した上長以外の削除は api がエラーを返す。成功時は /oneonone を revalidate する。
 */
export async function deleteOneOnOneAction(
  previousState: OneOnOneActionState,
  formData: FormData,
): Promise<OneOnOneActionState> {
  await requireAuth()

  const oneOnOneId = formData.get("one_on_one_id")

  if (typeof oneOnOneId !== "string" || oneOnOneId === "") {
    return { ok: false, error: "1on1 を特定できませんでした" }
  }

  const deleted = await deleteOneOnOne(oneOnOneId)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/my/oneonones")

  return { ok: true, error: null }
}

/** 任意テキスト欄の FormData 値を string | null へ。未入力や空白のみは null。 */
function toOneOnOneText(value: FormDataEntryValue | null, label: string): string | Error | null {
  return toOptionalText(value, {
    label,
    max: FORM_CONSTRAINTS.oneOnOne.textMax,
  })
}
