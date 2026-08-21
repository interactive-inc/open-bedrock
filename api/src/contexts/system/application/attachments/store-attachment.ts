import { encryptAttachment } from "@system/infrastructure/attachments/encrypt-attachment.repository"
import type { AttachmentBytes } from "@system/domain/values/attachment-bytes.definition"
import { validateAttachmentContent } from "@system/domain/policies/attachment-content.policy"
import { AttachmentKekRegistry } from "@system/infrastructure/attachments/attachment-kek-registry.repository"
import { AttachmentObjectStore } from "@system/infrastructure/attachments/attachment-object-store.repository"
import { AttachmentRepository } from "@system/infrastructure/attachments/attachment.repository"
import type {
  SystemAttachmentStorageContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context.repository"
import { PayloadTooLargeError, ValidationError } from "@/lib/errors"

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

function toViolationError(violation: string): Error {
  if (violation === "byte_size_exceeded") {
    return new PayloadTooLargeError(
      "添付が上限サイズを超えています",
      "attachment_byte_size_exceeded",
    )
  }

  return new ValidationError("添付を受け付けられません", `attachment_${violation}`)
}

/**
 * 添付を暗号化して保管する。行を先に予約してから本体を書き、最後に pending へ進めるため、
 * 途中で失敗しても object storage 側に行の無い孤児が残らない。
 */
export class StoreAttachment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: StoreAttachmentCommand): Promise<StoredAttachment | Error> {
    const violation = validateAttachmentContent({
      contentType: command.contentType,
      byteSize: command.content.byteLength,
      fileName: command.fileName,
    })

    if (violation !== null) return toViolationError(violation)

    const registry = AttachmentKekRegistry.fromEnv(this.c.env.ATTACHMENT_KEKS)

    if (registry instanceof Error) return registry

    const encrypted = await encryptAttachment(command.content, registry.current())

    const id = crypto.randomUUID()

    const objectKey = `att/${id}`

    const repository = new AttachmentRepository(this.c)

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

    const stored = await new AttachmentObjectStore(this.c).put(objectKey, encrypted.ciphertext)

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
