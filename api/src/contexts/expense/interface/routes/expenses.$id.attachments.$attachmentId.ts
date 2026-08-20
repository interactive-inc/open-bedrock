import { canReadExpense } from "@/contexts/expense/application/can-read-expense"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { ReadAttachment } from "@system/application/attachments/read-attachment"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { expenseAttachments, expenses } from "@/contexts/expense/infrastructure/schema/expense"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { and, eq } from "drizzle-orm"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"

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

  const content = await new ReadAttachment(c).run(attachmentId)

  if (content instanceof ApplicationError) {
    throw toHttpException(content)
  }

  if (content instanceof Error) {
    throw new InternalError("failed to read attachment")
  }

  const audit = createSystemAuditEvent({
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
