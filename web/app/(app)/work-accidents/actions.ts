"use server"

import { revalidatePath } from "next/cache"
import { createWorkAccident } from "@/lib/api/create-work-accident"
import { getMe } from "@/lib/api/get-me"
import { canManageWorkAccidents } from "@/lib/work-accident/can-manage-work-accidents"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type WorkAccidentActionState = {
  ok: boolean
  error: string | null
}

// 労災・事故の発生記録を登録する Server Action。work_accident:manage を確認してから API を叩く。
export async function createWorkAccidentAction(
  previousState: WorkAccidentActionState,
  formData: FormData,
): Promise<WorkAccidentActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageWorkAccidents(currentUser.permissions) === false) {
    return { ok: false, error: "労災・事故記録を管理する権限がありません" }
  }

  const occurredOn = toText(formData.get("occurred_on"))

  const summary = toText(formData.get("summary"))

  if (occurredOn === null || summary === null) {
    return { ok: false, error: "発生日と概要は必須です" }
  }

  const employeeId = toEmployeeId(formData.get("employee_id"))

  const created = await createWorkAccident({
    occurred_on: occurredOn,
    summary: summary,
    employee_id: employeeId,
    location: toText(formData.get("location")),
    severity: toSeverity(formData.get("severity")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/work-accidents")

  return { ok: true, error: null }
}

function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  return trimmed === "" ? null : trimmed
}

function toEmployeeId(value: FormDataEntryValue | null): number | null {
  const text = toText(value)

  if (text === null) {
    return null
  }

  const parsed = Number(text)

  if (Number.isInteger(parsed) === false || parsed <= 0) {
    return null
  }

  return parsed
}

function toSeverity(value: FormDataEntryValue | null): "minor" | "serious" | null {
  const text = toText(value)

  if (text === "minor" || text === "serious") {
    return text
  }

  return null
}
