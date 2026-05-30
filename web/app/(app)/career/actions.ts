"use server"

import { revalidatePath } from "next/cache"
import { applyCareerPosting } from "@/lib/api/apply-career-posting"
import { updateCareerSheet } from "@/lib/api/update-career-sheet"

export type CareerSheetFormState = {
  ok: boolean
  error: string | null
}

export type CareerApplyFormState = {
  ok: boolean
  error: string | null
}

// キャリアシート更新の Server Action。useActionState から呼ばれる。
// 空文字は値なし (null) として送る。
export async function updateCareerSheetAction(
  previousState: CareerSheetFormState,
  formData: FormData,
): Promise<CareerSheetFormState> {
  const goalsValue = formData.get("goals_text")

  const strengthsValue = formData.get("strengths_text")

  const goalsText = typeof goalsValue === "string" && goalsValue !== "" ? goalsValue : null

  const strengthsText =
    typeof strengthsValue === "string" && strengthsValue !== "" ? strengthsValue : null

  const updated = await updateCareerSheet({
    goals_text: goalsText,
    strengths_text: strengthsText,
  })

  if (updated instanceof Error) {
    return { ok: false, error: "キャリアシートの更新に失敗しました" }
  }

  revalidatePath("/career")

  return { ok: true, error: null }
}

// 社内公募への応募 Server Action。postingId は hidden フィールドから受け取る。
export async function applyCareerPostingAction(
  previousState: CareerApplyFormState,
  formData: FormData,
): Promise<CareerApplyFormState> {
  const postingIdValue = formData.get("posting_id")

  const messageValue = formData.get("message")

  const postingId = Number(postingIdValue)

  if (!Number.isInteger(postingId) || postingId <= 0) {
    return { ok: false, error: "公募が不正です" }
  }

  const message = typeof messageValue === "string" && messageValue !== "" ? messageValue : null

  const created = await applyCareerPosting(postingId, { message })

  if (created instanceof Error) {
    return { ok: false, error: "応募に失敗しました（既に応募済みの可能性があります）" }
  }

  revalidatePath("/career")

  return { ok: true, error: null }
}
