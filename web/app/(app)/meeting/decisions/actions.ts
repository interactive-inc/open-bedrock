"use server"

import { revalidatePath } from "next/cache"
import { createDecision } from "@/lib/api/create-decision"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type DecisionActionState = {
  ok: boolean
  error: string | null
}

/** 意思決定記録の作成 Server Action。title/decided_on/context/decision 必須。decision:manage が無いと api が 403。 */
export async function createDecisionAction(
  previousState: DecisionActionState,
  formData: FormData,
): Promise<DecisionActionState> {
  const title = toText(formData.get("title"))

  const decidedOn = toText(formData.get("decided_on"))

  const context = toText(formData.get("context"))

  const decision = toText(formData.get("decision"))

  if (title === null || decidedOn === null || context === null || decision === null) {
    return { ok: false, error: "タイトル・決定日・背景・決定内容を入力してください" }
  }

  const created = await createDecision({
    title: title,
    decided_on: decidedOn,
    context: context,
    decision: decision,
    consequences: toText(formData.get("consequences")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/meeting/decisions")

  return { ok: true, error: null }
}

/** FormData 値を文字列へ。未入力や空白のみは null。 */
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
