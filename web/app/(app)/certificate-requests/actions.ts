"use server"

import { revalidatePath } from "next/cache"
import { cancelCertificateRequest } from "@/lib/api/cancel-certificate-request"
import { createCertificateRequest } from "@/lib/api/create-certificate-request"
import { updateCertificateRequest } from "@/lib/api/update-certificate-request"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type CertificateRequestActionState = {
  ok: boolean
  error: string | null
}

// 証明書発行依頼作成 Server Action。certificate_type 必須、submit_to/needed_by/note は任意。
// 成功時は /certificate-requests を revalidate して一覧へ反映する。
export async function createCertificateRequestAction(
  previousState: CertificateRequestActionState,
  formData: FormData,
): Promise<CertificateRequestActionState> {
  const fields = toRequestFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const created = await createCertificateRequest(fields)

  if (created instanceof Error) {
    return { ok: false, error: "証明書発行依頼の作成に失敗しました" }
  }

  revalidatePath("/certificate-requests")

  return { ok: true, error: null }
}

// 証明書発行依頼変更 Server Action。certificate_request_id 必須。本人以外の変更は api がエラーを返す。
export async function updateCertificateRequestAction(
  previousState: CertificateRequestActionState,
  formData: FormData,
): Promise<CertificateRequestActionState> {
  const certificateRequestId = formData.get("certificate_request_id")

  if (typeof certificateRequestId !== "string" || certificateRequestId === "") {
    return { ok: false, error: "証明書発行依頼を特定できませんでした" }
  }

  const fields = toRequestFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const updated = await updateCertificateRequest(certificateRequestId, fields)

  if (updated instanceof Error) {
    return { ok: false, error: "証明書発行依頼の変更に失敗しました" }
  }

  revalidatePath("/certificate-requests")

  return { ok: true, error: null }
}

// 証明書発行依頼取消 Server Action。certificate_request_id 必須。成功時は /certificate-requests を revalidate する。
export async function cancelCertificateRequestAction(
  previousState: CertificateRequestActionState,
  formData: FormData,
): Promise<CertificateRequestActionState> {
  const certificateRequestId = formData.get("certificate_request_id")

  if (typeof certificateRequestId !== "string" || certificateRequestId === "") {
    return { ok: false, error: "証明書発行依頼を特定できませんでした" }
  }

  const cancelled = await cancelCertificateRequest(certificateRequestId)

  if (cancelled instanceof Error) {
    return { ok: false, error: "証明書発行依頼の取消に失敗しました" }
  }

  revalidatePath("/certificate-requests")

  return { ok: true, error: null }
}

type RequestFields = {
  certificate_type: string
  submit_to: string | null
  needed_by: string | null
  note: string | null
}

// FormData から証明書発行依頼の共通フィールドを取り出して検証する。不正時は Error。
function toRequestFields(formData: FormData): RequestFields | Error {
  const certificateType = formData.get("certificate_type")

  if (typeof certificateType !== "string" || certificateType.trim() === "") {
    return new Error("証明書種別を入力してください")
  }

  return {
    certificate_type: certificateType.trim(),
    submit_to: toNullableText(formData.get("submit_to")),
    needed_by: toNullableText(formData.get("needed_by")),
    note: toNullableText(formData.get("note")),
  }
}

// 任意テキストの FormData 値を取り出す。未入力は null。
function toNullableText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
