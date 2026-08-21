/**
 * 受け入れる添付の形式と大きさ。業務上の書類種別（領収書か証明書類か）は各業務contextが持ち、
 * System は「保管してよいバイト列か」だけを判定する。
 */
export const ATTACHMENT_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
] as const

export type AttachmentContentType = (typeof ATTACHMENT_CONTENT_TYPES)[number]

/** 本体は Worker のメモリ上で暗号化するため、ストリーミング不要な大きさに固定する。 */
export const ATTACHMENT_MAX_BYTE_SIZE = 25 * 1024 * 1024

export const ATTACHMENT_MAX_FILE_NAME_LENGTH = 255

export type AttachmentContentViolation =
  | "content_type_not_allowed"
  | "byte_size_exceeded"
  | "empty_content"
  | "file_name_empty"
  | "file_name_too_long"

export type AttachmentContentInput = Readonly<{
  contentType: string
  byteSize: number
  fileName: string
}>

function isAttachmentContentType(value: string): value is AttachmentContentType {
  return ATTACHMENT_CONTENT_TYPES.some((contentType) => contentType === value)
}

/** 受け入れ可否を判定する。違反があれば最初の 1 件を返す。 */
export function validateAttachmentContent(
  input: AttachmentContentInput,
): AttachmentContentViolation | null {
  if (!isAttachmentContentType(input.contentType)) return "content_type_not_allowed"

  if (input.byteSize <= 0) return "empty_content"

  if (input.byteSize > ATTACHMENT_MAX_BYTE_SIZE) return "byte_size_exceeded"

  const fileName = input.fileName.trim()

  if (fileName === "") return "file_name_empty"

  if (fileName.length > ATTACHMENT_MAX_FILE_NAME_LENGTH) return "file_name_too_long"

  return null
}
