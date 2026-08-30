import { encryptAttachment } from "@system/application/attachments/lib/encrypt-attachment"
import { SystemAttachmentError } from "@system/domain/errors"
import type { AttachmentBytes } from "@system/domain/definitions/attachments/attachment-bytes.definition"
import { validateAttachmentContent } from "@system/domain/policies/attachment-content.policy"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"
import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import type {
  SystemAttachmentStorageContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"

export type StoreAttachmentCommand = Readonly<{
  ownerAccountId: string
  fileName: string
  contentType: string
  content: AttachmentBytes
  now: Date
}>

export type StoredAttachment = Readonly<{
  id: string
  fileName: string
  contentType: string
  byteSize: number
  plaintextSha256: string
  createdAt: Date
}>

type Context = SystemDatabaseContext & SystemAttachmentStorageContext

/**
 * 添付を暗号化して保管する。行を先に予約してから本体を書き、最後に pending へ進めるため、
 * 途中で失敗しても object storage 側に行の無い孤児が残らない。
 */
export class StoreAttachment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  private static toViolationError(violation: string): Error {
    if (violation === "byte_size_exceeded") {
      return new SystemAttachmentError(
        "payload_too_large",
        "attachment_byte_size_exceeded",
        "添付が上限サイズを超えています",
      )
    }

    return new SystemAttachmentError(
      "validation",
      `attachment_${violation}`,
      "添付を受け付けられません",
    )
  }

  async run(command: StoreAttachmentCommand): Promise<StoredAttachment | Error> {
    const violation = validateAttachmentContent({
      contentType: command.contentType,
      byteSize: command.content.byteLength,
      fileName: command.fileName,
    })

    if (violation !== null) return StoreAttachment.toViolationError(violation)

    const registry = AttachmentKekRegistry.fromEnv(this.c.env.ATTACHMENT_KEKS)

    if (registry instanceof Error) return registry

    const encrypted = await encryptAttachment(command.content, registry.current())

    const id = crypto.randomUUID()

    const objectKey = `att/${id}`

    const repository = new AttachmentAdapter(this.c)

    const reserved = await repository.reserve({
      id,
      ownerAccountId: command.ownerAccountId,
      objectKey,
      contentType: command.contentType,
      byteSize: command.content.byteLength,
      fileName: command.fileName.trim(),
      plaintextSha256: encrypted.plaintextSha256,
      wrappedDek: encrypted.wrappedDek,
      wrappedDekIv: encrypted.wrappedDekIv,
      contentIv: encrypted.contentIv,
      kekVersion: encrypted.kekVersion,
      createdAt: command.now,
    })

    if (reserved instanceof Error) return reserved

    const stored = await new AttachmentObjectAdapter(this.c).put(objectKey, encrypted.ciphertext)

    if (stored instanceof Error) return stored

    const pending = await repository.markPending(id)

    if (pending instanceof Error) return pending

    return {
      id,
      fileName: command.fileName.trim(),
      contentType: command.contentType,
      byteSize: command.content.byteLength,
      plaintextSha256: encrypted.plaintextSha256,
      createdAt: command.now,
    }
  }
}
