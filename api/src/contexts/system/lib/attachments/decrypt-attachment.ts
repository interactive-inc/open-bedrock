import type { AttachmentBytes } from "@system/domain/definitions/attachments/attachment-bytes.definition"
import { SystemAttachmentError } from "@system/domain/errors"
import { fromBase64 } from "@system/lib/attachments/from-base64"
import { importAesKey } from "@system/lib/attachments/import-aes-key"
import { unwrapDek } from "@system/lib/attachments/unwrap-dek"
import type { AttachmentKek } from "@system/lib/attachments/attachment-kek-registry"
import type { WrappedKeyMaterial } from "@system/lib/attachments/attachment-key-material"

/** 暗号文を復号する。鍵破棄済み（wrappedDek が無い）ものはここへ来る前に拒否する。 */
export async function decryptAttachment(
  ciphertext: AttachmentBytes,
  material: WrappedKeyMaterial & Readonly<{ contentIv: string }>,
  kek: AttachmentKek,
): Promise<AttachmentBytes | Error> {
  const dek = await unwrapDek(material, kek)

  if (dek instanceof Error) return dek

  const contentKey = await importAesKey(dek, "decrypt")

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(material.contentIv) },
      contentKey,
      ciphertext,
    )

    return new Uint8Array(plaintext)
  } catch {
    return new SystemAttachmentError(
      "unprocessable",
      "attachment_decrypt_failed",
      "添付を復号できません",
    )
  }
}
