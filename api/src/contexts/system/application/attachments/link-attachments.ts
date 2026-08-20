import { AttachmentRepository } from "@system/infrastructure/attachments/attachment-repository"
import type { SystemDatabaseContext } from "@system/infrastructure/configuration/system-context"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"

export type LinkAttachmentsCommand = Readonly<{
  attachmentIds: ReadonlyArray<string>
  ownerAccountId: string
  now: Date
}>

/**
 * 業務レコードへ紐づける。アップロード本人の pending だけを linked へ進める。
 * どの業務レコードに属するかは各業務contextが自分のテーブルで持つ。
 */
export class LinkAttachments {
  constructor(private readonly c: SystemDatabaseContext) {
    Object.freeze(this)
  }

  async run(command: LinkAttachmentsCommand): Promise<void | Error> {
    if (command.attachmentIds.length === 0) return undefined

    const unique = new Set(command.attachmentIds)

    if (unique.size !== command.attachmentIds.length) {
      return new ValidationError("添付が重複しています", "attachment_duplicated")
    }

    const repository = new AttachmentRepository(this.c)

    const rows = await repository.findManyByIds(command.attachmentIds)

    if (rows instanceof Error) return rows

    if (rows.length !== unique.size) {
      return new NotFoundError("添付が見つかりません", "attachment_not_found")
    }

    for (const row of rows) {
      if (row.ownerAccountId !== command.ownerAccountId) {
        return new ForbiddenError("他人の添付は紐づけできません", "attachment_not_owned")
      }

      if (row.status !== "pending") {
        return new ValidationError(
          "この添付は紐づけできる状態ではありません",
          "attachment_not_pending",
        )
      }
    }

    for (const row of rows) {
      const linked = await repository.markLinked(row.id, command.now)

      if (linked instanceof Error) return linked
    }

    return undefined
  }
}
