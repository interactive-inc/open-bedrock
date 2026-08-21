import type { AttachmentBytes } from "@system/domain/values/attachment-bytes.definition"
import { fromBase64 } from "@system/infrastructure/attachments/from-base64.repository"
import { importAesKey } from "@system/infrastructure/attachments/import-aes-key.repository"
import { unwrapDek } from "@system/infrastructure/attachments/unwrap-dek.repository"
import type { AttachmentKek } from "@system/infrastructure/attachments/attachment-kek-registry.repository"
import type { WrappedKeyMaterial } from "@system/infrastructure/attachments/attachment-key-material.repository"
import { UnprocessableError } from "@/lib/errors"

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
    return new UnprocessableError("添付を復号できません", "attachment_decrypt_failed")
  }
}
