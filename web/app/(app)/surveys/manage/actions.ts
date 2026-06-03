"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createSurvey } from "@/lib/api/create-survey"
import { deleteSurvey } from "@/lib/api/delete-survey"
import { updateSurvey } from "@/lib/api/update-survey"

// アンケート作成・編集フォームの useActionState 結果。
export type SurveyFormState = {
  ok: boolean
  error: string | null
}

const statusSchema = z.enum(["open", "closed"])

const questionsJsonSchema = z.array(z.unknown())

// FormData の survey id を数値へ変換する。不正なら null。
function toSurveyId(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null
  }

  const parsed = Number(value)

  return Number.isInteger(parsed) ? parsed : null
}

// FormData の questions テキストを設問配列へ検証付きで変換する。空なら空配列、不正なら Error。
function toQuestionsJson(value: FormDataEntryValue | null): ReadonlyArray<unknown> | Error {
  if (typeof value !== "string" || value.trim() === "") {
    return []
  }

  try {
    const parsed = questionsJsonSchema.safeParse(JSON.parse(value))

    if (parsed.success === false) {
      return new Error("設問は配列形式の JSON で入力してください")
    }

    return parsed.data
  } catch {
    return new Error("設問の JSON を解釈できませんでした")
  }
}

// アンケート作成の Server Action。タイトル・状態・設問 JSON を検証して POST する。
export async function createSurveyAction(
  previousState: SurveyFormState,
  formData: FormData,
): Promise<SurveyFormState> {
  const titleValue = formData.get("title")

  const title = typeof titleValue === "string" ? titleValue : ""

  if (title.trim() === "") {
    return { ok: false, error: "タイトルを入力してください" }
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
    return { ok: false, error: "アンケートの作成に失敗しました" }
  }

  revalidatePath("/surveys/manage")

  return { ok: true, error: null }
}

// アンケート編集の Server Action。id は hidden、タイトル・状態・設問 JSON を更新する。
export async function updateSurveyAction(
  previousState: SurveyFormState,
  formData: FormData,
): Promise<SurveyFormState> {
  const surveyId = toSurveyId(formData.get("id"))

  if (surveyId === null) {
    return { ok: false, error: "アンケートが不正です" }
  }

  const titleValue = formData.get("title")

  const title = typeof titleValue === "string" ? titleValue : ""

  if (title.trim() === "") {
    return { ok: false, error: "タイトルを入力してください" }
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
    return { ok: false, error: "アンケートの更新に失敗しました" }
  }

  revalidatePath("/surveys/manage")

  return { ok: true, error: null }
}

// アンケート削除の Server Action。id は hidden から受け取る。成功時は一覧へ遷移する。
export async function deleteSurveyAction(
  previousState: SurveyFormState,
  formData: FormData,
): Promise<SurveyFormState> {
  const surveyId = toSurveyId(formData.get("id"))

  if (surveyId === null) {
    return { ok: false, error: "アンケートが不正です" }
  }

  const deleted = await deleteSurvey(surveyId)

  if (deleted instanceof Error) {
    return { ok: false, error: "アンケートの削除に失敗しました" }
  }

  revalidatePath("/surveys/manage")

  // 削除後は一覧へ遷移する。redirect は内部で throw するので最後に呼ぶ。
  redirect("/surveys/manage")
}
