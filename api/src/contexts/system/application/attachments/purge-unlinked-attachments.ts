import { AttachmentObjectStore } from "@system/infrastructure/attachments/attachment-object-store"
import { AttachmentRepository } from "@system/infrastructure/attachments/attachment-repository"
import type {
  SystemAttachmentStorageContext,
  SystemDatabaseContext,
} from "@system/infrastructure/configuration/system-context"

/**
 * 業務レコードへ紐づかないまま期限を過ぎた添付を消す。申請に至らなかったファイルは
 * 記録の一部ではないので、本体も行も物理削除してよい。
 *
 * 期限は「アップロード時刻から 24 時間経過」で判定する（表記とバッチ実行時刻は JST でそろえる）。
 * バッチの実行間隔ぶん、実際の削除は最大で 24h + 実行間隔まで遅れる。
 */
export const UNLINKED_ATTACHMENT_RETENTION_MILLISECONDS = 24 * 60 * 60 * 1000

export type PurgeUnlinkedAttachmentsCommand = Readonly<{
  now: Date
  limit?: number
}>

export type PurgeUnlinkedAttachmentsResult = Readonly<{
  purgedCount: number
}>

type Context = SystemDatabaseContext & SystemAttachmentStorageContext

export class PurgeUnlinkedAttachments {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(
    command: PurgeUnlinkedAttachmentsCommand,
  ): Promise<PurgeUnlinkedAttachmentsResult | Error> {
    const threshold = new Date(command.now.getTime() - UNLINKED_ATTACHMENT_RETENTION_MILLISECONDS)

    const repository = new AttachmentRepository(this.c)

    const stale = await repository.listStaleUnlinked(threshold, command.limit ?? 100)

    if (stale instanceof Error) return stale

    const store = new AttachmentObjectStore(this.c)

    let purgedCount = 0

    for (const row of stale) {
      const deleted = await store.delete(row.objectKey)

      if (deleted instanceof Error) return deleted

      const removed = await repository.deleteUnlinked(row.id)

      if (removed instanceof Error) return removed

      purgedCount += 1
    }

    return { purgedCount }
  }
}
