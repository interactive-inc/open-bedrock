import { AttachmentRepository } from "@system/infrastructure/attachments/attachment-repository"
import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context"

export type AttachmentDescription = Readonly<{
  id: string
  fileName: string
  contentType: string
  byteSize: number
}>

/**
 * 添付のメタデータだけを返す。本体は返さないので、一覧表示に使う。
 * どの業務レコードに属するかは呼び出し側の context が持つ。
 */
export class DescribeAttachments {
  constructor(private readonly c: SystemDatabaseContext) {
    Object.freeze(this)
  }

  async run(
    attachmentIds: ReadonlyArray<string>,
  ): Promise<ReadonlyArray<AttachmentDescription> | Error> {
    const rows = await new AttachmentRepository(this.c).findManyByIds(attachmentIds)

    if (rows instanceof Error) return rows

    return rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      contentType: row.contentType,
      byteSize: row.byteSize,
    }))
  }
}
