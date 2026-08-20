/** /attachments */
import { StoreAttachment } from "@system/application/attachments/store-attachment"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
import { systemFactory } from "@system/interface/http/system-factory"
import { ApplicationError } from "@/lib/errors"

function toHttpStatus(error: ApplicationError): 400 | 413 | 500 | 503 {
  if (error.code === "attachment_byte_size_exceeded") return 413

  if (error.code === "attachment_storage_unconfigured") return 503

  if (error.code.startsWith("attachment_") && error.code.endsWith("_failed")) return 500

  return 400
}

// @authorization authenticated - ログインしていれば自分の添付を預けられる。業務レコードへの紐づけは各業務contextが認可する
/** POST /attachments — 添付を暗号化して預け、pending の attachment_id を返す */
export const POST = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  const form = await context.req.parseBody()

  const file = form.file

  if (!(file instanceof File)) {
    throw new SystemHttpError({
      status: 400,
      code: "attachment_file_required",
      detail: "file field is required",
    })
  }

  const stored = await new StoreAttachment(context).run({
    ownerAccountId: context.var.userId,
    fileName: file.name,
    contentType: file.type,
    content: new Uint8Array(await file.arrayBuffer()),
    now: context.var.now(),
  })

  if (stored instanceof ApplicationError) {
    throw new SystemHttpError({
      status: toHttpStatus(stored),
      code: stored.code,
      detail: stored.message,
    })
  }

  if (stored instanceof Error) {
    throw new SystemHttpError({
      status: 500,
      code: "attachment_store_failed",
      detail: "attachment store failed",
    })
  }

  return context.json(
    {
      id: stored.id,
      file_name: stored.fileName,
      content_type: stored.contentType,
      byte_size: stored.byteSize,
      sha256: stored.plaintextSha256,
      status: "pending",
      created_at: stored.createdAt.toISOString(),
    },
    201,
  )
})
