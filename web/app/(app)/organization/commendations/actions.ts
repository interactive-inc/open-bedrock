"use server"

import { revalidatePath } from "next/cache"
import { createCommendation } from "@/lib/api/create-commendation"
import { deleteCommendation } from "@/lib/api/delete-commendation"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type CommendationActionState = {
  ok: boolean
  error: string | null
}

// 表彰の記録の作成 Server Action。employee_id/title/reason/awarded_on 必須。commendation:manage が無いと api が 403。
export async function createCommendationAction(
  previousState: CommendationActionState,
  formData: FormData,
): Promise<CommendationActionState> {
  const employeeId = toPositiveInt(formData.get("employee_id"))

  const title = toText(formData.get("title"))

  const reason = toText(formData.get("reason"))

  const awardedOn = toText(formData.get("awarded_on"))

  if (employeeId === null || title === null || reason === null || awardedOn === null) {
    return { ok: false, error: "従業員ID・タイトル・理由・表彰日を入力してください" }
  }

  const created = await createCommendation({
    employee_id: employeeId,
    title: title,
    reason: reason,
    awarded_on: awardedOn,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/organization/commendations")

  return { ok: true, error: null }
}

// 表彰の記録の削除 Server Action。commendation:manage が無いと api が 403。
export async function deleteCommendationAction(
  previousState: CommendationActionState,
  formData: FormData,
): Promise<CommendationActionState> {
  const id = toPositiveInt(formData.get("id"))

  if (id === null) {
    return { ok: false, error: "削除対象が不正です" }
  }

  const deleted = await deleteCommendation(id)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/organization/commendations")

  return { ok: true, error: null }
}

// FormData 値を文字列へ。未入力や空白のみは null。
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

// FormData 値を正の整数へ。不正値は null。
function toPositiveInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null
  }

  const parsed = Number.parseInt(value, 10)

  if (Number.isInteger(parsed) === false || parsed <= 0) {
    return null
  }

  return parsed
}
