import { GovernanceAccessAdapter } from "@/contexts/governance/infrastructure/adapters/governance-access.adapter"
import { ResolveGovernanceOrgRoleAdapter } from "@/contexts/governance/infrastructure/adapters/resolve-governance-org-role.adapter"
import { GovernanceAdapter } from "@/contexts/governance/infrastructure/adapters/governance.adapter"
import { factory } from "@/api/http/factory"
import { ForbiddenError, InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { parseGovernanceCode } from "@/contexts/governance/interface/http/parse-governance-code"
import { toGovernanceDocumentResponse } from "@/contexts/governance/interface/http/governance-documents/to-governance-document-response"
import { verifyBearer } from "@/api/http/verify-bearer"

// @authorization service - session を application service に渡して判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const code = parseGovernanceCode(c.req.param("code"))
  if (code === null) throw new NotFoundError("governance document not found")
  const repository = new GovernanceAdapter(c)
  const governanceAccess = new GovernanceAccessAdapter({ context: c, session })
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
      const assignees = await new ResolveGovernanceOrgRoleAdapter(c).resolveGovernanceOrgRole(
        approval.org_role_code,
      )
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
