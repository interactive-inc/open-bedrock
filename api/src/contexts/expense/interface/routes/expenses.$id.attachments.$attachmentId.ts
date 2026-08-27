import { decryptAttachment } from "@system/infrastructure/attachments/decrypt-attachment.repository"
import { toSha256Hex } from "@system/infrastructure/attachments/to-sha256-hex.repository"
import { AttachmentKekRegistry } from "@system/infrastructure/attachments/attachment-kek-registry.repository"
import { AttachmentObjectStore } from "@system/infrastructure/attachments/attachment-object-store.repository"
import { AttachmentRepository } from "@system/infrastructure/attachments/attachment.repository"
import { NotFoundError as ApplicationNotFoundError, UnprocessableError } from "@/lib/errors"
import { canReadExpense } from "@/contexts/expense/infrastructure/adapters/can-read-expense.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event.repository"
import { expenseAttachments, expenses } from "@/contexts/expense/infrastructure/schema/expense"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { and, eq } from "drizzle-orm"
import { ForbiddenError, InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"

// @authorization service - 親の経費の閲覧可否をそのまま添付へ継承する
/** GET /expenses/:id/attachments/:attachmentId — 経費に紐づいた添付を取り出す */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const expenseId = validateIntParam(c.req.param("id"), "expense")

  const attachmentId = c.req.param("attachmentId") ?? ""

  const rows = await c.var.database
    .select({ applicantId: expenses.employeeId })
    .from(expenseAttachments)
    .innerJoin(expenses, eq(expenses.id, expenseAttachments.expenseId))
    .where(
      and(
        eq(expenseAttachments.expenseId, expenseId),
        eq(expenseAttachments.attachmentId, attachmentId),
      ),
    )
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("attachment not found")
  }

  const readable = await canReadExpense(c, {
    session,
    applicantEmployeeId: row.applicantId,
  })

  if (readable instanceof Error) {
    throw new InternalError("failed to resolve organization scope")
  }

  if (readable === false) {
    throw new ForbiddenError()
  }

  const content = await (async () => {
    const row = await new AttachmentRepository(c).findById(attachmentId)

    if (row instanceof Error) return row

    if (row === null) {
      return new ApplicationNotFoundError("添付が見つかりません", "attachment_not_found")
    }

    if (row.status === "erased" || row.wrappedDek === null || row.wrappedDekIv === null) {
      return new ApplicationNotFoundError("この添付は消去済みです", "attachment_erased")
    }

    const registry = AttachmentKekRegistry.fromEnv(c.env.ATTACHMENT_KEKS)

    if (registry instanceof Error) return registry

    const kek = registry.resolve(row.kekVersion)

    if (kek instanceof Error) return kek

    const ciphertext = await new AttachmentObjectStore(c).get(row.objectKey)

    if (ciphertext instanceof Error) return ciphertext

    const plaintext = await decryptAttachment(
      ciphertext,
      {
        wrappedDek: row.wrappedDek,
        wrappedDekIv: row.wrappedDekIv,
        contentIv: row.contentIv,
        kekVersion: row.kekVersion,
      },
      kek,
    )

    if (plaintext instanceof Error) return plaintext

    const digest = await toSha256Hex(plaintext)

    if (digest !== row.plaintextSha256) {
      return new UnprocessableError(
        "添付の内容がメタデータと一致しません",
        "attachment_integrity_mismatch",
      )
    }

    return {
      id: row.id,
      fileName: row.fileName,
      contentType: row.contentType,
      byteSize: row.byteSize,
      content: plaintext,
    }
  })()

  if (content instanceof ApplicationError) {
    throw toHttpException(content)
  }

  if (content instanceof Error) {
    throw new InternalError("failed to read attachment")
  }

  const audit = SystemAuditEventEntity.create({
    actorAccountId: String(session.accountId),
    action: "expense.attachment.read",
    targetType: "attachment",
    targetId: attachmentId,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: null,
    occurredAt: c.var.now(),
  })

  if (!(audit instanceof Error)) {
    await new SystemAuditEventRepository({ env: { DB: c.env.DB } }).append(audit)
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
