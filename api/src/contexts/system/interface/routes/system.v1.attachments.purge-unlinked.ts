/** /system/v1/attachments/purge-unlinked */
import { PurgeUnlinkedAttachments } from "@system/application/attachments/purge-unlinked-attachments"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
import { systemFactory } from "@system/interface/http/system-factory"

/**
 * 紐づかないまま期限を過ぎた添付を掃除する。既存のバッチ同様、実行は HTTP から起こす
 * （定期実行は運用側のスケジューラが叩く）。冪等なので複数回呼んでも安全。
 */
// @authorization permission - 本体を物理削除するため system:admin に限定する
export const POST = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin")) {
    throw new SystemHttpError({
      status: 403,
      code: "forbidden",
      detail: "forbidden",
    })
  }

  const result = await new PurgeUnlinkedAttachments(context).run({
    now: context.var.now(),
  })

  if (result instanceof Error) {
    throw new SystemHttpError({
      status: 503,
      code: "attachment_purge_unavailable",
      detail: "attachment purge unavailable",
    })
  }

  return context.json({ purged_count: result.purgedCount }, 200)
})
