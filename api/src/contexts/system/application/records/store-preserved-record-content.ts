import { StoreEncryptedAttachmentAdapter } from "@system/infrastructure/adapters/attachments/store-encrypted-attachment.adapter"
import { toBase64 } from "@system/application/attachments/lib/to-base64"
import { ATTACHMENT_MAX_BYTE_SIZE } from "@system/domain/catalogs/attachments/attachment-content.catalog"
import type { AttachmentBytes } from "@system/domain/definitions/attachments/attachment-bytes.definition"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { PreservedRecordContentValue } from "@system/domain/values/records/preserved-record-content.value"
import type {
  SystemAttachmentStorageContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"

type Context = SystemDatabaseContext & SystemAttachmentStorageContext

type Command = Readonly<{
  source: unknown
  content: AttachmentBytes
  ownerAccountId: string
  now: Date
}>

/** 原記録と取得情報を可逆な形式で暗号化し、保全確定前の未紐付け本文を準備する。 */
export class StorePreservedRecordContent {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command) {
    const source = PreservedRecordSourceValue.create(command.source)
    if (source instanceof Error) return source
    if (
      !Number.isSafeInteger(command.now.getTime()) ||
      Date.parse(source.props.capturedAt) > command.now.getTime() ||
      command.content.byteLength > Math.floor(ATTACHMENT_MAX_BYTE_SIZE / 4) * 3
    )
      return new Error("invalid record capture time or payload size")
    const content = await PreservedRecordContentValue.create(source, command.content)
    if (content instanceof Error) return content
    const payload = new TextEncoder().encode(
      JSON.stringify({
        version: 1,
        source: source.props,
        contentBase64: toBase64(new Uint8Array(content.toBytes())),
      }),
    )
    const attachment = await new StoreEncryptedAttachmentAdapter(this.c).run({
      ownerAccountId: command.ownerAccountId,
      fileName: "preserved-record.json",
      contentType: "application/vnd.record-preservation+json",
      content: payload,
      now: command.now,
    })
    if (attachment instanceof Error) return attachment
    return { source, attachment }
  }
}
