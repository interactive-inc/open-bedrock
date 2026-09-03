"use server"

import { revalidatePath } from "next/cache"
import { createItIncident } from "@/lib/api/create-it-incident"
import { resolveItIncident } from "@/lib/api/resolve-it-incident"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type ItIncidentActionState = {
  ok: boolean
  error: string | null
}

/** インシデント記録の登録 Server Action。it_incident:manage が無いと api が 403。 */
export async function createItIncidentAction(
  previousState: ItIncidentActionState,
  formData: FormData,
): Promise<ItIncidentActionState> {
  const occurredAt = toText(formData.get("occurred_at"))

  const title = toText(formData.get("title"))

  const summary = toText(formData.get("summary"))

  if (occurredAt === null || title === null || summary === null) {
    return { ok: false, error: "発生日時・タイトル・概要を入力してください" }
  }

  const created = await createItIncident({
    occurred_at: occurredAt,
    title: title,
    summary: summary,
    severity: toSeverity(formData.get("severity")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/it-incident/it-incidents")

  return { ok: true, error: null }
}

/** インシデント解消 Server Action。form の hidden input で id を渡す。it_incident:manage が無いと api が 403。 */
export async function resolveItIncidentAction(
  previousState: ItIncidentActionState,
  formData: FormData,
): Promise<ItIncidentActionState> {
  const id = toInteger(formData.get("id"))

  if (id === null) {
    return { ok: false, error: "対象のインシデントが不明です" }
  }

  const resolved = await resolveItIncident(id)

  if (resolved instanceof Error) {
    return { ok: false, error: resolved.message }
  }

  revalidatePath("/it-incident/it-incidents")

  return { ok: true, error: null }
}

/** FormData 値を文字列へ。未入力や空白のみは null。 */
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

/** FormData 値を整数へ。未入力や不正は null。 */
function toInteger(value: FormDataEntryValue | null): number | null {
  const text = toText(value)

  if (text === null) {
    return null
  }

  const parsed = Number(text)

  return Number.isInteger(parsed) ? parsed : null
}

/** severity の許容値だけを返す。それ以外は null。 */
function toSeverity(
  value: FormDataEntryValue | null,
): "low" | "medium" | "high" | "critical" | null {
  const text = toText(value)

  if (text === "low" || text === "medium" || text === "high" || text === "critical") {
    return text
  }

  return null
}
