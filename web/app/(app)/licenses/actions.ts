"use server"

import { revalidatePath } from "next/cache"
import { cancelLicense } from "@/lib/api/cancel-license"
import { createLicense } from "@/lib/api/create-license"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type LicenseActionState = {
  ok: boolean
  error: string | null
}

// ライセンス台帳の登録 Server Action。name 必須。license:manage が無いと api が 403。
export async function createLicenseAction(
  previousState: LicenseActionState,
  formData: FormData,
): Promise<LicenseActionState> {
  const name = toText(formData.get("name"))

  if (name === null) {
    return { ok: false, error: "名称を入力してください" }
  }

  const created = await createLicense({
    name: name,
    vendor: toText(formData.get("vendor")),
    category: toCategory(formData.get("category")),
    seats: toInteger(formData.get("seats")),
    renewal_deadline: toText(formData.get("renewal_deadline")),
    owner_employee_id: toInteger(formData.get("owner_employee_id")),
    note: toText(formData.get("note")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/licenses")

  return { ok: true, error: null }
}

// ライセンス解約 Server Action。form の hidden input で id を渡す。license:manage が無いと api が 403。
export async function cancelLicenseAction(
  previousState: LicenseActionState,
  formData: FormData,
): Promise<LicenseActionState> {
  const id = toInteger(formData.get("id"))

  if (id === null) {
    return { ok: false, error: "対象のライセンスが不明です" }
  }

  const cancelled = await cancelLicense(id)

  if (cancelled instanceof Error) {
    return { ok: false, error: cancelled.message }
  }

  revalidatePath("/licenses")

  return { ok: true, error: null }
}

// FormData 値を文字列へ。未入力や空白のみは null。
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

// FormData 値を整数へ。未入力や不正は null。
function toInteger(value: FormDataEntryValue | null): number | null {
  const text = toText(value)

  if (text === null) {
    return null
  }

  const parsed = Number(text)

  return Number.isInteger(parsed) ? parsed : null
}

// category の許容値だけを返す。それ以外は null。
function toCategory(value: FormDataEntryValue | null): "saas" | "software" | "other" | null {
  const text = toText(value)

  if (text === "saas" || text === "software" || text === "other") {
    return text
  }

  return null
}
