"use server"

import { revalidatePath } from "next/cache"
import { submitSurveyResponse } from "@/lib/api/submit-survey-response"
import { updateSurveyResponse } from "@/lib/api/update-survey-response"
import { withdrawSurveyResponse } from "@/lib/api/withdraw-survey-response"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"
import { fitsJsonStringifiedLength } from "@/lib/form/fits-json-stringified-length"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import { requireAuth } from "@/lib/auth/require-auth"

/**
 * useActionState のタプル要素となるアクション結果。
 * status で成否を表し、message は画面のトースト/エラー表示に使う。
 */
export type SubmitSurveyResponseState = {
  status: "idle" | "success" | "error"
  message: string | null
}

/**
 * アンケート回答送信の Server Action。
 * FormData から questions の id 別回答を集めて answers_json を組み立て、API に送る。
 */
export async function submitSurveyResponseAction(
  previousState: SubmitSurveyResponseState,
  formData: FormData,
): Promise<SubmitSurveyResponseState> {
  await requireAuth()

  const surveyId = toPositiveIntId(formData.get("surveyId"))

  if (surveyId === null) {
    return { status: "error", message: "アンケート ID が不正です" }
  }

  const answersJson: Record<string, unknown> = {}

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer:")) {
      if (typeof value !== "string") {
        return { status: "error", message: "回答は文字列で入力してください" }
      }

      const questionId = key.slice("answer:".length)

      answersJson[questionId] = value
    }
  }

  if (fitsJsonStringifiedLength(answersJson, FORM_CONSTRAINTS.survey.answersJsonMax) === false) {
    return {
      status: "error",
      message: `回答全体は${FORM_CONSTRAINTS.survey.answersJsonMax}文字以内で入力してください`,
    }
  }

  const submission = await submitSurveyResponse(surveyId, {
    answers_json: answersJson,
  })

  if (submission instanceof Error) {
    return { status: "error", message: submission.message }
  }

  revalidatePath(`/survey/surveys/${surveyId}`)
  revalidatePath("/my/survey-responses")
  revalidatePath(`/survey/surveys/${surveyId}/summary`)

  return { status: "success", message: "回答を送信しました" }
}

/**
 * my-responses-list の Dialog/取り下げフォームが使う useActionState の結果。
 * ok で成否を表し、error はフォーム内のエラー表示に使う。
 */
export type MyResponseActionState = {
  ok: boolean
  error: string | null
}

/**
 * アンケート回答変更の Server Action。
 * FormData の responseId と answer:* を集めて answers_json を組み立て、PUT に送る。
 */
export async function updateSurveyResponseAction(
  previousState: MyResponseActionState,
  formData: FormData,
): Promise<MyResponseActionState> {
  await requireAuth()

  const responseId = toPositiveIntId(formData.get("responseId"))

  if (responseId === null) {
    return { ok: false, error: "回答 ID が不正です" }
  }

  const answersJson: Record<string, unknown> = {}

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer:")) {
      if (typeof value !== "string") {
        return { ok: false, error: "回答は文字列で入力してください" }
      }

      const questionId = key.slice("answer:".length)

      answersJson[questionId] = value
    }
  }

  if (fitsJsonStringifiedLength(answersJson, FORM_CONSTRAINTS.survey.answersJsonMax) === false) {
    return {
      ok: false,
      error: `回答全体は${FORM_CONSTRAINTS.survey.answersJsonMax}文字以内で入力してください`,
    }
  }

  const updated = await updateSurveyResponse(responseId, {
    answers_json: answersJson,
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/my/survey-responses")

  return { ok: true, error: null }
}

/**
 * アンケート回答取り下げの Server Action。
 * FormData の responseId を読み、DELETE に送る。
 */
export async function withdrawSurveyResponseAction(
  previousState: MyResponseActionState,
  formData: FormData,
): Promise<MyResponseActionState> {
  await requireAuth()

  const responseId = toPositiveIntId(formData.get("responseId"))

  if (responseId === null) {
    return { ok: false, error: "回答 ID が不正です" }
  }

  const result = await withdrawSurveyResponse(responseId)

  if (result instanceof Error) {
    return { ok: false, error: result.message }
  }

  revalidatePath("/my/survey-responses")

  return { ok: true, error: null }
}
