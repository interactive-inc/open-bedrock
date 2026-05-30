"use server"

import { revalidatePath } from "next/cache"
import { submitSurveyResponse } from "@/lib/api/submit-survey-response"

// useActionState のタプル要素となるアクション結果。
// status で成否を表し、message は画面のトースト/エラー表示に使う。
export type SubmitSurveyResponseState = {
  status: "idle" | "success" | "error"
  message: string | null
}

// アンケート回答送信の Server Action。
// FormData から questions の id 別回答を集めて answers_json を組み立て、API に送る。
export async function submitSurveyResponseAction(
  previousState: SubmitSurveyResponseState,
  formData: FormData,
): Promise<SubmitSurveyResponseState> {
  const surveyIdRaw = formData.get("surveyId")

  const surveyId = Number(surveyIdRaw)

  if (!Number.isInteger(surveyId)) {
    return { status: "error", message: "アンケート ID が不正です" }
  }

  const answersJson: Record<string, unknown> = {}

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer:")) {
      const questionId = key.slice("answer:".length)

      answersJson[questionId] = value
    }
  }

  const submission = await submitSurveyResponse(surveyId, {
    answers_json: answersJson,
  })

  if (submission instanceof Error) {
    return { status: "error", message: "回答の送信に失敗しました" }
  }

  revalidatePath(`/surveys/${surveyId}/summary`)

  return { status: "success", message: "回答を送信しました" }
}
