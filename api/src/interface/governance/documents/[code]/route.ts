import {
  canManageGovernance,
  canPublishGovernance,
  canReadGovernanceDocument,
  canReviewGovernance,
  resolveGovernanceOrgRole,
} from "@/application/governance/governance-access"
import { GovernanceRepository } from "@/infrastructure/governance/governance-repository"
import { factory } from "@/lib/factory"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import {
  parseGovernanceCode,
  toGovernanceDocumentResponse,
} from "@/interface/governance/governance-route-shared"
import { verifyBearer } from "@/interface/shared/verify-bearer"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const code = parseGovernanceCode(c.req.param("code"))
  if (code === null) throw new NotFoundError("governance document not found")
  const repository = new GovernanceRepository(c)
  const elevated =
    canManageGovernance(session) || canReviewGovernance(session) || canPublishGovernance(session)
  let record = await repository.findVisibleRecord({ code, includeDraft: elevated })
  if (record instanceof Error) throw new InternalError("failed to load governance document")
  if (record === null || record.version === null)
    throw new NotFoundError("governance document not found")
  let allowed = await canReadGovernanceDocument({
    c,
    session,
    metadata: record.version.metadata,
    isDraft: record.version.row.state !== "published",
  })
  if (allowed instanceof Error) throw new InternalError("failed to resolve governance audience")
  if (!allowed && record.row.currentVersionId !== null) {
    record = await repository.findVisibleRecord({ code, includeDraft: false })
    if (record instanceof Error) throw new InternalError("failed to load governance document")
    if (record === null || record.version === null) throw new ForbiddenError()
    allowed = await canReadGovernanceDocument({
      c,
      session,
      metadata: record.version.metadata,
      isDraft: false,
    })
    if (allowed instanceof Error) throw new InternalError("failed to resolve governance audience")
  }
  if (!allowed) throw new ForbiddenError()
  const acknowledged = await repository.hasAcknowledged(record.version.row.id, session.employeeId)
  if (acknowledged instanceof Error) throw new InternalError("failed to load acknowledgement")
  const response = toGovernanceDocumentResponse(record, {
    acknowledged,
    includeSource: elevated,
  })
  if (response === null) throw new NotFoundError("governance document not found")
  const approvalEligibility = await Promise.all(
    response.approvals.map(async (approval) => {
      if (!canReviewGovernance(session) || approval.status !== "pending") return false
      const assignees = await resolveGovernanceOrgRole({ c, code: approval.org_role_code })
      if (assignees instanceof Error)
        throw new InternalError("failed to resolve governance reviewer")
      return assignees.some((assignee) => assignee.employee_id === session.employeeId)
    }),
  )
  return c.json(
    {
      ...response,
      approvals: response.approvals.map((approval, index) => ({
        ...approval,
        can_decide: approvalEligibility[index] ?? false,
      })),
    },
    200,
  )
})
