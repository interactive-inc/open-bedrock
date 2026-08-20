import { decryptAttachment } from "@system/infrastructure/attachments/decrypt-attachment"
import { toSha256Hex } from "@system/infrastructure/attachments/to-sha256-hex"
import type { AttachmentBytes } from "@system/domain/attachments/attachment-bytes"
import { AttachmentKekRegistry } from "@system/infrastructure/attachments/attachment-kek-registry"
import { AttachmentObjectStore } from "@system/infrastructure/attachments/attachment-object-store"
import { AttachmentRepository } from "@system/infrastructure/attachments/attachment-repository"
import type {
  SystemAttachmentStorageContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"
import { NotFoundError, UnprocessableError } from "@/lib/errors"

export type AttachmentContent = Readonly<{
  id: string
  fileName: string
  contentType: string
  byteSize: number
  content: AttachmentBytes
}>

type Context = SystemDatabaseContext & SystemAttachmentStorageContext

/**
 * 添付本体を復号して返す。呼び出し側が認可を済ませていることを前提にした port で、
 * ここでは所有者や業務レコードの閲覧権限を判定しない。
 */
export class ReadAttachment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(attachmentId: string): Promise<AttachmentContent | Error> {
    const row = await new AttachmentRepository(this.c).findById(attachmentId)

    if (row instanceof Error) return row

    if (row === null) {
      return new NotFoundError("添付が見つかりません", "attachment_not_found")
    }

    if (row.status === "erased" || row.wrappedDek === null || row.wrappedDekIv === null) {
      return new NotFoundError("この添付は消去済みです", "attachment_erased")
    }

    const registry = AttachmentKekRegistry.fromEnv(this.c.env.ATTACHMENT_KEKS)

    if (registry instanceof Error) return registry

    const kek = registry.resolve(row.kekVersion)

    if (kek instanceof Error) return kek

    const ciphertext = await new AttachmentObjectStore(this.c).get(row.objectKey)

    if (ciphertext instanceof Error) return ciphertext

    const plaintext = await decryptAttachment(
      ciphertext,
      {
        wrappedDek: row.wrappedDek,
        wrappedDekIv: row.wrappedDekIv,
        contentIv: row.contentIv,
        kekVersion: row.kekVersion,
      },
      kek,
    )

    if (plaintext instanceof Error) return plaintext

    const digest = await toSha256Hex(plaintext)

    if (digest !== row.plaintextSha256) {
      return new UnprocessableError(
        "添付の内容がメタデータと一致しません",
        "attachment_integrity_mismatch",
      )
    }

    return {
      id: row.id,
      fileName: row.fileName,
      contentType: row.contentType,
      byteSize: row.byteSize,
      content: plaintext,
    }
  }
}
