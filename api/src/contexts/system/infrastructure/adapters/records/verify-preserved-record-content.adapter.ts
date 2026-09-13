import type {
  SystemAttachmentStorageContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import type { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import { PreservedRecordPayloadValue } from "@system/domain/values/records/preserved-record-payload.value"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"
import { decryptAttachment } from "@system/application/attachments/lib/decrypt-attachment"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"

type Context = SystemDatabaseContext & SystemAttachmentStorageContext

/** 暗号化された保全本文を読み戻し、原記録と取得情報の一致を検証する。 */
export class VerifyPreservedRecordContentAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(record: PreservedRecordEntity, expectedStatus: "pending" | "linked") {
    const attachment = await new AttachmentAdapter(this.c).findById(record.snapshot.attachmentId)
    if (attachment instanceof Error) return attachment
    if (
      !attachment ||
      attachment.status !== expectedStatus ||
      attachment.ownerAccountId !== record.snapshot.actorAccountId ||
      attachment.contentType !== "application/vnd.record-preservation+json" ||
      attachment.plaintextSha256 !== record.snapshot.attachmentDigest ||
      attachment.createdAt.getTime() > Date.parse(record.snapshot.finalizedAt) ||
      attachment.wrappedDek === null ||
      attachment.wrappedDekIv === null
    )
      return new Error("prepared record attachment is unavailable or mismatched")
    const registry = AttachmentKekRegistry.fromEnv(this.c.env.ATTACHMENT_KEKS)
    if (registry instanceof Error) return registry
    const key = registry.resolve(attachment.kekVersion)
    if (key instanceof Error) return key
    const ciphertext = await new AttachmentObjectAdapter(this.c).get(attachment.objectKey)
    if (ciphertext instanceof Error) return ciphertext
    const bytes = await decryptAttachment(
      ciphertext,
      {
        wrappedDek: attachment.wrappedDek,
        wrappedDekIv: attachment.wrappedDekIv,
        contentIv: attachment.contentIv,
        kekVersion: attachment.kekVersion,
      },
      key,
    )
    if (bytes instanceof Error) return bytes
    if (
      bytes.byteLength !== attachment.byteSize ||
      (await toSha256Hex(bytes)) !== record.snapshot.attachmentDigest
    )
      return new Error("prepared record payload digest or size does not match")
    const payload = await PreservedRecordPayloadValue.restore(bytes, record.source)
    if (payload instanceof Error) return payload
    return Object.freeze({ attachment, payload })
  }
}
