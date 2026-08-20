/** /attachments/:attachmentId */
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { ReadAttachment } from "@system/application/attachments/read-attachment"
import { AttachmentRepository } from "@system/infrastructure/attachments/attachment-repository"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
import { systemFactory } from "@system/interface/http/system-factory"
import { ApplicationError } from "@/lib/errors"

/**
 * 紐づけ前の添付を、預けた本人だけが取り出す。業務レコードへ紐づいた後の閲覧は
 * 各業務context側の URL が親レコードの閲覧権限で認可する（System は業務の認可規則を知らない）。
 */
// @authorization owner - アップロード本人の未紐づけ添付に限定する
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  const attachmentId = context.req.param("attachmentId") ?? ""

  if (attachmentId === "") {
    throw new SystemHttpError({
      status: 404,
      code: "attachment_not_found",
      detail: "attachment not found",
    })
  }

  const row = await new AttachmentRepository(context).findById(attachmentId)

  if (row instanceof Error) {
    throw new SystemHttpError({
      status: 503,
      code: "attachment_unavailable",
      detail: "attachment service unavailable",
    })
  }

  if (row === null || row.ownerAccountId !== context.var.userId) {
    throw new SystemHttpError({
      status: 404,
      code: "attachment_not_found",
      detail: "attachment not found",
    })
  }

  if (row.status !== "pending" && row.status !== "uploading") {
    throw new SystemHttpError({
      status: 404,
      code: "attachment_not_pending",
      detail: "attachment is linked to a record",
    })
  }

  const content = await new ReadAttachment(context).run(attachmentId)

  if (content instanceof ApplicationError) {
    throw new SystemHttpError({
      status: content.code === "attachment_storage_unconfigured" ? 503 : 404,
      code: content.code,
      detail: content.message,
    })
  }

  if (content instanceof Error) {
    throw new SystemHttpError({
      status: 500,
      code: "attachment_read_failed",
      detail: "attachment read failed",
    })
  }

  const audit = createSystemAuditEvent({
    actorAccountId: context.var.userId,
    action: "attachment.read",
    targetType: "attachment",
    targetId: attachmentId,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: null,
    occurredAt: context.var.now(),
  })

  if (!(audit instanceof Error)) {
    await new SystemAuditEventRepository({ env: { DB: context.env.DB } }).append(audit)
  }

  return new Response(content.content, {
    status: 200,
    headers: {
      "content-type": content.contentType,
      "content-length": String(content.byteSize),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(content.fileName)}`,
      "cache-control": "no-store",
    },
  })
})
