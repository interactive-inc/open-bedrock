import { AttachmentObjectStore } from "@system/infrastructure/attachments/attachment-object-store.repository"
import { AttachmentRepository } from "@system/infrastructure/attachments/attachment.repository"
import { UNLINKED_ATTACHMENT_RETENTION_MILLISECONDS } from "@system/domain/catalogs/attachments/unlinked-attachment-retention.catalog"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import {
  SystemAttachmentPurgeUnavailableError,
  SystemForbiddenError,
} from "@system/interface/errors"
import { systemFactory } from "@system/interface/http/system-factory"

/**
 * 紐づかないまま期限を過ぎた添付を掃除する。既存のバッチ同様、実行は HTTP から起こす
 * （定期実行は運用側のスケジューラが叩く）。冪等なので複数回呼んでも安全。
 */
// @authorization permission - 本体を物理削除するため system:admin に限定する
export const POST = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin")) {
    throw new SystemForbiddenError()
  }

  const result = await (async () => {
    const command = {
      now: context.var.now(),
    }

    const threshold = new Date(command.now.getTime() - UNLINKED_ATTACHMENT_RETENTION_MILLISECONDS)

    const repository = new AttachmentRepository(context)

    const stale = await repository.listStaleUnlinked(threshold, 100)

    if (stale instanceof Error) return stale

    const store = new AttachmentObjectStore(context)

    let purgedCount = 0

    for (const row of stale) {
      const deleted = await store.delete(row.objectKey)

      if (deleted instanceof Error) return deleted

      const removed = await repository.deleteUnlinked(row.id)

      if (removed instanceof Error) return removed

      purgedCount += 1
    }

    return { purgedCount }
  })()

  if (result instanceof Error) {
    throw new SystemAttachmentPurgeUnavailableError(result)
  }

  return context.json({ purged_count: result.purgedCount }, 200)
})
