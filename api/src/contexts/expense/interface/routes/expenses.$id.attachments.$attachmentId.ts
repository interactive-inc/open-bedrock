import { decryptAttachment } from "@system/application/attachments/lib/decrypt-attachment"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"
import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { NotFoundError as ApplicationNotFoundError, UnprocessableError } from "@/lib/errors"
import { ExpenseProcedureReadAdapter } from "@/contexts/expense/infrastructure/adapters/expense-procedure-read.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { expenseAttachments, expenses } from "@/contexts/expense/infrastructure/schema/expense"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { and, eq } from "drizzle-orm"
import { InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"

// @authorization service - 親の経費の閲覧可否をそのまま添付へ継承する
/** GET /expenses/:id/attachments/:attachmentId — 経費に紐づいた添付を取り出す */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null || c.var.accountTokenVersion === null) {
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

  const reader = new ExpenseProcedureReadAdapter(c)
  const view = await reader.find({
    expenseId,
    session,
    tokenVersion: c.var.accountTokenVersion,
    at: new Date(c.env.NOW ?? Date.now()),
  })
  if (view instanceof ApplicationError) throw toHttpException(view)
  const evidence = view.attachments.find((attachment) => attachment.id === attachmentId)
  if (evidence === undefined) throw new NotFoundError("attachment not found")

  const content = await (async () => {
    const row = await new AttachmentAdapter(c).findById(attachmentId)

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

    const ciphertext = await new AttachmentObjectAdapter(c).get(row.objectKey)

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

    if (
      digest !== row.plaintextSha256 ||
      (evidence.sha256 !== null && digest !== evidence.sha256)
    ) {
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

  const current = await reader.find({
    expenseId,
    session,
    tokenVersion: c.var.accountTokenVersion,
    at: new Date(c.env.NOW ?? Date.now()),
  })
  if (current instanceof ApplicationError) throw toHttpException(current)
  if (!current.evidence_available)
    throw toHttpException(
      new UnprocessableError("確認した添付を利用できません", "attachment_evidence_changed"),
    )
  if (audit instanceof Error) throw new InternalError("閲覧監査を作成できません")
  const savedAudit = await new SystemAuditEventRepository({ env: { DB: c.env.DB } }).append(audit)
  if (savedAudit instanceof Error) throw new InternalError("閲覧監査を保存できません")

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
