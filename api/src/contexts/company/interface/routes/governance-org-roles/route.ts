import { resolveGovernanceOrgRole } from "@/contexts/company/application/governance/resolve-governance-org-role"
import { GovernanceRepository } from "@/contexts/company/infrastructure/governance/governance-repository"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  if (
    !session.permissions.has("governance:read") &&
    !session.permissions.has("governance:manage")
  ) {
    throw new ForbiddenError()
  }
  const repository = new GovernanceRepository(c)
  const roles = await repository.listOrgRoles()
  if (roles instanceof Error)
    throw new InternalError("failed to list governance organization roles")
  const resolved = await Promise.all(
    roles.map(async (role) => ({
      role,
      assignees: await resolveGovernanceOrgRole({ c, code: role.code }),
    })),
  )
  if (resolved.some((item) => item.assignees instanceof Error)) {
    throw new InternalError("failed to resolve governance organization roles")
  }
  return c.json(
    {
      data: resolved.map((item) => ({
        ...item.role,
        assignees: item.assignees instanceof Error ? [] : item.assignees,
      })),
    },
    200,
  )
})
