"use server"

import { revalidatePath } from "next/cache"
import { applyCareerPosting } from "@/lib/api/apply-career-posting"
import { updateCareerApplication } from "@/lib/api/update-career-application"
import { updateCareerSheet } from "@/lib/api/update-career-sheet"
import { withdrawCareerApplication } from "@/lib/api/withdraw-career-application"

export type CareerSheetFormState = {
  ok: boolean
  error: string | null
}

export type CareerApplyFormState = {
  ok: boolean
  error: string | null
}

export type CareerApplicationActionState = {
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

// 応募メッセージ変更の Server Action。application_id 必須、空文字は値なし (null)。
// 選考確定済みは api が 409 を返し Error になる。
export async function updateCareerApplicationAction(
  previousState: CareerApplicationActionState,
  formData: FormData,
): Promise<CareerApplicationActionState> {
  const applicationId = toApplicationId(formData.get("application_id"))

  if (applicationId === null) {
    return { ok: false, error: "応募を特定できませんでした" }
  }

  const messageValue = formData.get("message")

  const message = typeof messageValue === "string" && messageValue !== "" ? messageValue : null

  const updated = await updateCareerApplication(applicationId, { message })

  if (updated instanceof Error) {
    return { ok: false, error: "応募の変更に失敗しました（選考が確定している可能性があります）" }
  }

  revalidatePath("/career")

  return { ok: true, error: null }
}

// 応募取り下げの Server Action。application_id 必須。
// 選考確定済みは api が 409 を返し Error になる。
export async function withdrawCareerApplicationAction(
  previousState: CareerApplicationActionState,
  formData: FormData,
): Promise<CareerApplicationActionState> {
  const applicationId = toApplicationId(formData.get("application_id"))

  if (applicationId === null) {
    return { ok: false, error: "応募を特定できませんでした" }
  }

  const withdrawn = await withdrawCareerApplication(applicationId)

  if (withdrawn instanceof Error) {
    return {
      ok: false,
      error: "応募の取り下げに失敗しました（選考が確定している可能性があります）",
    }
  }

  revalidatePath("/career")

  return { ok: true, error: null }
}

// application_id の FormData 値を正の整数へ。未入力や不正値は null。
function toApplicationId(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value === "") {
    return null
  }

  const parsed = Number(value)

  if (Number.isInteger(parsed) === false || parsed <= 0) {
    return null
  }

  return parsed
}
