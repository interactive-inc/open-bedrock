import { decryptAttachment } from "@system/application/attachments/lib/decrypt-attachment"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"
import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"
import { UnprocessableError } from "@/lib/errors"
import { PrepareExpenseAttachmentReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-attachment-read.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { factory } from "@/api/http/factory"
import { ApplicationError, ForbiddenError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { InternalError, UnauthorizedError } from "@/lib/http/errors"

// @authorization service - 親の経費の閲覧可否をそのまま添付へ継承する
/** GET /expenses/:id/attachments/:attachmentId — 経費に紐づいた添付を取り出す */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null || c.var.accountTokenVersion === null) {
    throw new UnauthorizedError()
  }

  const expenseId = validateIntParam(c.req.param("id"), "expense")

  const attachmentId = c.req.param("attachmentId") ?? ""

  const authentication = c.var.bearerReadAuthentication
  if (authentication === undefined) throw new UnauthorizedError()
  const prepared = await new PrepareExpenseAttachmentReadAdapter(c).prepare({
    expenseId,
    attachmentId,
    authentication,
    session,
    at: c.var.now(),
  })
  if (prepared instanceof ApplicationError) throw toHttpException(prepared)
  if (prepared instanceof Error) throw new InternalError("failed to prepare attachment read")
  const initial = prepared.assertions(c.var.now())
  if (initial instanceof Error)
    throw toHttpException(
      new ForbiddenError("閲覧資格が変わりました", "read_authorization_changed"),
    )
  try {
    const checked = await c.env.DB.batch([...initial])
    if (checked.length !== initial.length || checked.some((item) => !item.success))
      throw new Error("attachment read validation failed")
  } catch {
    throw toHttpException(
      new ForbiddenError("閲覧資格または添付が変わりました", "read_authorization_changed"),
    )
  }
  const content = await (async () => {
    const row = prepared.attachment
    if (row.wrappedDek === null || row.wrappedDekIv === null)
      return new UnprocessableError("この添付は消去済みです", "attachment_erased")

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

    if (digest !== row.plaintextSha256 || plaintext.byteLength !== row.byteSize) {
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
    authorizationJson: JSON.stringify({
      policy: "expense-current-reader",
      accountId: session.accountId,
      tokenVersion: authentication.tokenVersion,
      machineCredentialId: authentication.machineCredentialId,
      identityBindingId: authentication.identityBindingId,
    }),
    beforeJson: null,
    afterJson: null,
    metadataJson: JSON.stringify({
      expenseId,
      sha256: prepared.attachment.plaintextSha256,
      byteSize: prepared.attachment.byteSize,
    }),
    occurredAt: c.var.now(),
  })

  if (audit instanceof Error) throw new InternalError("閲覧監査を作成できません")
  const assertions = prepared.assertions(c.var.now())
  if (assertions instanceof Error)
    throw toHttpException(
      new ForbiddenError("閲覧資格が変わりました", "read_authorization_changed"),
    )
  const savedAudit = await new SystemAuditEventRepository({ env: { DB: c.env.DB } }).append(
    audit,
    assertions,
    assertions,
  )
  if (savedAudit instanceof Error) {
    const visited = new Set<Error>()
    for (
      let cause: unknown = savedAudit;
      cause instanceof Error && !visited.has(cause);
      cause = cause.cause
    ) {
      visited.add(cause)
      if (cause.message.includes("attachment_read_content_changed"))
        throw toHttpException(
          new UnprocessableError("確認した添付を利用できません", "attachment_evidence_changed"),
        )
      if (
        /system_read_authorization_changed|system_case_read_changed|expense_attachment_read_changed|malformed JSON/.test(
          cause.message,
        )
      )
        throw toHttpException(
          new ForbiddenError("閲覧資格または案件が変わりました", "read_authorization_changed"),
        )
    }
    throw new InternalError("閲覧監査を保存できません")
  }

  return new Response(content.content, {
    status: 200,
    headers: {
      "content-type": content.contentType,
      "content-length": String(content.byteSize),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(content.fileName)}`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  })
})
