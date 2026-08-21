import type { AttachmentBytes } from "@system/domain/attachments/attachment-bytes"

/** バイト列を base64 にする。D1 へ鍵と IV を載せるために使う。 */
export function toBase64(bytes: AttachmentBytes): string {
  let binary = ""

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}
