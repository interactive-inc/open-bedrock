import { GovernanceAccess } from "@/contexts/governance/application/governance-access"
import { resolveGovernanceOrgRole } from "@/contexts/governance/application/resolve-governance-org-role"
import { GovernanceRepository } from "@/contexts/governance/infrastructure/governance-repository"
import { factory } from "@/contexts/company/interface/utils/factory"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { parseGovernanceCode } from "@/contexts/company/interface/utils/parse-governance-code"
import { toGovernanceDocumentResponse } from "@/contexts/governance/interface/lib/to-governance-document-response"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"

// @authorization service - session を application service に渡して判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const code = parseGovernanceCode(c.req.param("code"))
  if (code === null) throw new NotFoundError("governance document not found")
  const repository = new GovernanceRepository(c)
  const governanceAccess = new GovernanceAccess({ c, session })
  const elevated =
    governanceAccess.canManage() || governanceAccess.canReview() || governanceAccess.canPublish()
  let record = await repository.findVisibleRecord({ code, includeDraft: elevated })
  if (record instanceof Error) throw new InternalError("failed to load governance document")
  if (record === null || record.version === null)
    throw new NotFoundError("governance document not found")
  let allowed = await governanceAccess.canReadDocument({
    metadata: record.version.metadata,
    isDraft: record.version.row.state !== "published",
  })
  if (allowed instanceof Error) throw new InternalError("failed to resolve governance audience")
  if (!allowed && record.row.currentVersionId !== null) {
    record = await repository.findVisibleRecord({ code, includeDraft: false })
    if (record instanceof Error) throw new InternalError("failed to load governance document")
    if (record === null || record.version === null) throw new ForbiddenError()
    allowed = await governanceAccess.canReadDocument({
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
      if (!governanceAccess.canReview() || approval.status !== "pending") return false
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
