import type { AttachmentBytes } from "@system/domain/values/attachment-bytes.definition"

/** 用途を限定した AES-GCM 鍵として取り込む。 */
export function importAesKey(
  raw: AttachmentBytes,
  usage: "encrypt" | "decrypt",
): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [usage])
}
