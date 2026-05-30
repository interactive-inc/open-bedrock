"use server"

import { revalidatePath } from "next/cache"
import { createOneOnOne } from "@/lib/api/create-oneonone"

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

// 任意テキスト欄の FormData 値を string | null へ。未入力は null。
function toOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value === "") {
    return null
  }

  return value
}
