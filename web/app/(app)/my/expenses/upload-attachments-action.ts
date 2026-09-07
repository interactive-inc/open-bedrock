"use server"

import { uploadAttachment, type UploadedAttachment } from "@/lib/api/upload-attachment"
import { requireAuth } from "@/lib/auth/require-auth"

/** 提出前に添付を預け、再送でも同じ添付を指定できるよう識別子を返す。 */
export async function uploadExpenseAttachmentsAction(form: FormData) {
  await requireAuth()
  const files = form
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
  const uploaded: UploadedAttachment[] = []
  if (files.length === 0 || files.length > 10)
    return { uploaded, error: "添付は1件から10件まで選択してください" }
  for (const file of files) {
    const attachment = await uploadAttachment(file)
    if (attachment instanceof Error) return { uploaded, error: attachment.message }
    uploaded.push(attachment)
  }
  return { uploaded, error: null }
}
