import type { AttachmentBytes } from "@system/domain/attachments/attachment-bytes"
import { fromBase64 } from "@system/infrastructure/attachments/from-base64.repository"
import { importAesKey } from "@system/infrastructure/attachments/import-aes-key.repository"
import type { AttachmentKek } from "@system/infrastructure/attachments/attachment-kek-registry.repository"
import type { WrappedKeyMaterial } from "@system/infrastructure/attachments/attachment-key-material.repository"
import { UnprocessableError } from "@/lib/errors"

/** 包まれた DEK を取り出す。鍵が違えば復号できず、破棄済みならここで失敗する。 */
export async function unwrapDek(
  material: WrappedKeyMaterial,
  kek: AttachmentKek,
): Promise<AttachmentBytes | Error> {
  const wrappingKey = await importAesKey(kek.key, "decrypt")

  try {
    const dek = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(material.wrappedDekIv) },
      wrappingKey,
      fromBase64(material.wrappedDek),
    )

    return new Uint8Array(dek)
  } catch {
    return new UnprocessableError("添付の鍵を復号できません", "attachment_key_unwrap_failed")
  }
}
