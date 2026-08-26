import type { AttachmentBytes } from "@system/domain/definitions/attachments/attachment-bytes.definition"
import { SystemAttachmentError } from "@system/domain/errors"
import { fromBase64 } from "@system/lib/attachments/from-base64"
import { importAesKey } from "@system/lib/attachments/import-aes-key"
import type { AttachmentKek } from "@system/lib/attachments/attachment-kek-registry"
import type { WrappedKeyMaterial } from "@system/lib/attachments/attachment-key-material"

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
    return new SystemAttachmentError(
      "unprocessable",
      "attachment_key_unwrap_failed",
      "添付の鍵を復号できません",
    )
  }
}
