"use server"

import { revalidatePath } from "next/cache"
import { registerDocument } from "@/lib/api/register-document"
import { updateDocument } from "@/lib/api/update-document"
import { getMe } from "@/lib/api/get-me"
import { canManageDocuments } from "@/lib/document/can-manage-documents"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

export type DocumentActionState = {
  ok: boolean
  error: string | null
}

// 文書登録 Server Action。title/location 必須、その他は任意。
export async function registerDocumentAction(
  previousState: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageDocuments(currentUser.permissions) === false) {
    return { ok: false, error: "文書を管理する権限がありません" }
  }

  const title = toText(formData.get("title"))

  const location = toText(formData.get("location"))

  if (title === null || location === null) {
    return { ok: false, error: "タイトルと所在を入力してください" }
  }

  const registered = await registerDocument({
    title: title,
    location: location,
    category: toOptional(formData.get("category")),
    partner_code: toOptional(formData.get("partner_code")),
    expires_on: toOptional(formData.get("expires_on")),
    note: toOptional(formData.get("note")),
  })

  if (registered instanceof Error) {
    return { ok: false, error: registered.message }
  }

  revalidatePath("/organization/documents")

  return { ok: true, error: null }
}

// 文書更新 Server Action。document_id/title/location 必須。
export async function updateDocumentAction(
  previousState: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageDocuments(currentUser.permissions) === false) {
    return { ok: false, error: "文書を管理する権限がありません" }
  }

  const documentId = toPositiveIntId(formData.get("document_id"))

  if (documentId === null) {
    return { ok: false, error: "文書を特定できませんでした" }
  }

  const title = toText(formData.get("title"))

  const location = toText(formData.get("location"))

  if (title === null || location === null) {
    return { ok: false, error: "タイトルと所在を入力してください" }
  }

  const updated = await updateDocument(documentId, {
    title: title,
    location: location,
    category: toOptional(formData.get("category")),
    partner_code: toOptional(formData.get("partner_code")),
    expires_on: toOptional(formData.get("expires_on")),
    note: toOptional(formData.get("note")),
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/organization/documents")

  return { ok: true, error: null }
}

function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

function toOptional(value: FormDataEntryValue | null): string | undefined {
  const text = toText(value)

  return text === null ? undefined : text
}
