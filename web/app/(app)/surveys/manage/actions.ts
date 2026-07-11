"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createSurvey } from "@/lib/api/create-survey"
import { deleteSurvey } from "@/lib/api/delete-survey"
import { getMe } from "@/lib/api/get-me"
import { updateSurvey } from "@/lib/api/update-survey"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import type { SurveyQuestion } from "@/lib/api/types/survey-types"
import { canManageSurveys } from "@/lib/survey/can-manage-surveys"
import { FORM_CONSTRAINTS, toRequiredText } from "@/lib/form/constraints"

// アンケート作成・編集フォームの useActionState 結果。
export type SurveyFormState = {
  ok: boolean
  error: string | null
}

const statusSchema = z.enum(["open", "closed"])

const questionsJsonSchema = z
  .array(
    z.object({
      id: z.string(),
      type: z.enum(["scale", "choice", "text"]),
      text: z.string(),
    }),
  )
  .max(FORM_CONSTRAINTS.survey.questionsMax)

// FormData の questions テキストを設問配列へ検証付きで変換する。空なら空配列、不正なら Error。
function toQuestionsJson(value: FormDataEntryValue | null): ReadonlyArray<SurveyQuestion> | Error {
  if (typeof value !== "string" || value.trim() === "") {
    return []
  }

  try {
    const parsed = questionsJsonSchema.safeParse(JSON.parse(value))

    if (parsed.success === false) {
      return new Error("設問は id/type/text を持つ配列形式の JSON で入力してください")
    }

    return parsed.data
  } catch {
    return new Error("設問の JSON を解釈できませんでした")
  }
}

// アンケート作成の Server Action。タイトル・状態・設問 JSON を検証して POST する。
// Server Action は直接呼べるため getMe のロールで二重に弾く（defense-in-depth）。
export async function createSurveyAction(
  previousState: SurveyFormState,
  formData: FormData,
): Promise<SurveyFormState> {
  const me = await getMe()

  if (me instanceof Error || !canManageSurveys(me.permissions)) {
    return { ok: false, error: "権限がありません" }
  }

  const title = toRequiredText(formData.get("title"), {
    label: "タイトル",
    max: FORM_CONSTRAINTS.survey.titleMax,
  })

  if (title instanceof Error) {
    return { ok: false, error: title.message }
  }

  const status = statusSchema.safeParse(formData.get("status"))

  if (status.success === false) {
    return { ok: false, error: "状態は open か closed を選んでください" }
  }

  const questionsJson = toQuestionsJson(formData.get("questions_json"))

  if (questionsJson instanceof Error) {
    return { ok: false, error: questionsJson.message }
  }

  const created = await createSurvey({
    title: title,
    status: status.data,
    questions_json: questionsJson,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/surveys")
  revalidatePath("/surveys/manage")

  return { ok: true, error: null }
}

// アンケート編集の Server Action。id は hidden、タイトル・状態・設問 JSON を更新する。
// Server Action は直接呼べるため getMe のロールで二重に弾く（defense-in-depth）。
export async function updateSurveyAction(
  previousState: SurveyFormState,
  formData: FormData,
): Promise<SurveyFormState> {
  const me = await getMe()

  if (me instanceof Error || !canManageSurveys(me.permissions)) {
    return { ok: false, error: "権限がありません" }
  }

  const surveyId = toPositiveIntId(formData.get("id"))

  if (surveyId === null) {
    return { ok: false, error: "アンケートが不正です" }
  }

  const title = toRequiredText(formData.get("title"), {
    label: "タイトル",
    max: FORM_CONSTRAINTS.survey.titleMax,
  })

  if (title instanceof Error) {
    return { ok: false, error: title.message }
  }

  const status = statusSchema.safeParse(formData.get("status"))

  if (status.success === false) {
    return { ok: false, error: "状態は open か closed を選んでください" }
  }

  const questionsJson = toQuestionsJson(formData.get("questions_json"))

  if (questionsJson instanceof Error) {
    return { ok: false, error: questionsJson.message }
  }

  const updated = await updateSurvey(surveyId, {
    title: title,
    status: status.data,
    questions_json: questionsJson,
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/surveys")
  revalidatePath("/surveys/manage")
  revalidatePath(`/surveys/${surveyId}`)
  revalidatePath(`/surveys/${surveyId}/edit`)
  revalidatePath(`/surveys/${surveyId}/summary`)

  return { ok: true, error: null }
}

// アンケート削除の Server Action。id は hidden から受け取る。成功時は一覧へ遷移する。
// Server Action は直接呼べるため getMe のロールで二重に弾く（defense-in-depth）。
export async function deleteSurveyAction(
  previousState: SurveyFormState,
  formData: FormData,
): Promise<SurveyFormState> {
  const me = await getMe()

  if (me instanceof Error || !canManageSurveys(me.permissions)) {
    return { ok: false, error: "権限がありません" }
  }

  const surveyId = toPositiveIntId(formData.get("id"))

  if (surveyId === null) {
    return { ok: false, error: "アンケートが不正です" }
  }

  const deleted = await deleteSurvey(surveyId)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/surveys")
  revalidatePath("/surveys/manage")

  // 削除後は一覧へ遷移する。redirect は内部で throw するので最後に呼ぶ。
  redirect("/surveys/manage")
}
