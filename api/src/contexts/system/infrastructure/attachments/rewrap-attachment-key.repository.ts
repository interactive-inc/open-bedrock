import { importAesKey } from "@system/infrastructure/attachments/import-aes-key.repository"
import { toBase64 } from "@system/infrastructure/attachments/to-base64.repository"
import { unwrapDek } from "@system/infrastructure/attachments/unwrap-dek.repository"
import type { AttachmentKek } from "@system/infrastructure/attachments/attachment-kek-registry.repository"
import type { WrappedKeyMaterial } from "@system/infrastructure/attachments/attachment-key-material.repository"
import { ATTACHMENT_IV_BYTE_LENGTH } from "@system/infrastructure/attachments/attachment-key-material.repository"

/**
 * KEK ローテーションの包み直し。DEK を旧 KEK で取り出して新 KEK で包み直すだけで、
 * object storage の本体には触れないため、添付数が増えても実行時間は行更新に比例する。
 */
export async function rewrapAttachmentKey(
  material: WrappedKeyMaterial,
  currentKek: AttachmentKek,
  nextKek: AttachmentKek,
): Promise<WrappedKeyMaterial | Error> {
  const dek = await unwrapDek(material, currentKek)

  if (dek instanceof Error) return dek

  const dekIv = crypto.getRandomValues(new Uint8Array(ATTACHMENT_IV_BYTE_LENGTH))

  const wrappingKey = await importAesKey(nextKek.key, "encrypt")

  const wrappedDek = await crypto.subtle.encrypt({ name: "AES-GCM", iv: dekIv }, wrappingKey, dek)

  return {
    wrappedDek: toBase64(new Uint8Array(wrappedDek)),
    wrappedDekIv: toBase64(dekIv),
    kekVersion: nextKek.version,
  }
}
