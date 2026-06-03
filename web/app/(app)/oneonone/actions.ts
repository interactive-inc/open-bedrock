"use server"

import { revalidatePath } from "next/cache"
import { createOneOnOne } from "@/lib/api/create-oneonone"
import { deleteOneOnOne } from "@/lib/api/delete-oneonone"
import { updateOneOnOne } from "@/lib/api/update-oneonone"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type OneOnOneActionState = {
  ok: boolean
  error: string | null
}

// 1on1 記録作成 Server Action。member_email 必須、topics/manager_note/next_action は任意。
// 成功時は /oneonone を revalidate して履歴へ反映する。
export async function createOneOnOneAction(
  previousState: OneOnOneActionState,
  formData: FormData,
): Promise<OneOnOneActionState> {
  const memberEmail = formData.get("member_email")

  if (typeof memberEmail !== "string" || memberEmail === "") {
    return { ok: false, error: "メンバーのメールアドレスを入力してください" }
  }

  const topics = toOptionalText(formData.get("topics"))

  const managerNote = toOptionalText(formData.get("manager_note"))

  const nextAction = toOptionalText(formData.get("next_action"))

  const created = await createOneOnOne({
    member_email: memberEmail,
    topics,
    manager_note: managerNote,
    next_action: nextAction,
  })

  if (created instanceof Error) {
    return { ok: false, error: "1on1 の記録に失敗しました" }
  }

  revalidatePath("/oneonone")

  return { ok: true, error: null }
}

// 1on1 記録変更 Server Action。one_on_one_id 必須、topics/manager_note/next_action は任意。
// 記録した上長以外の変更は api がエラーを返す。成功時は /oneonone を revalidate する。
export async function updateOneOnOneAction(
  previousState: OneOnOneActionState,
  formData: FormData,
): Promise<OneOnOneActionState> {
  const oneOnOneId = formData.get("one_on_one_id")

  if (typeof oneOnOneId !== "string" || oneOnOneId === "") {
    return { ok: false, error: "1on1 を特定できませんでした" }
  }

  const updated = await updateOneOnOne(oneOnOneId, {
    topics: toOptionalText(formData.get("topics")),
    manager_note: toOptionalText(formData.get("manager_note")),
    next_action: toOptionalText(formData.get("next_action")),
  })

  if (updated instanceof Error) {
    return { ok: false, error: "1on1 の変更に失敗しました" }
  }

  revalidatePath("/oneonone")

  return { ok: true, error: null }
}

// 1on1 記録削除 Server Action。one_on_one_id 必須。
// 記録した上長以外の削除は api がエラーを返す。成功時は /oneonone を revalidate する。
export async function deleteOneOnOneAction(
  previousState: OneOnOneActionState,
  formData: FormData,
): Promise<OneOnOneActionState> {
  const oneOnOneId = formData.get("one_on_one_id")

  if (typeof oneOnOneId !== "string" || oneOnOneId === "") {
    return { ok: false, error: "1on1 を特定できませんでした" }
  }

  const deleted = await deleteOneOnOne(oneOnOneId)

  if (deleted instanceof Error) {
    return { ok: false, error: "1on1 の削除に失敗しました" }
  }

  revalidatePath("/oneonone")

  return { ok: true, error: null }
}

// 任意テキスト欄の FormData 値を string | null へ。未入力は null。
function toOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value === "") {
    return null
  }

  return value
}
