import { resolveGovernanceOrgRole } from "@/contexts/governance/infrastructure/resolve-governance-org-role.repository"
import { GovernanceRepository } from "@/contexts/governance/infrastructure/governance.repository"
import { factory } from "@/api/http/factory"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/lib/http/errors"
import { verifyBearer } from "@/api/http/verify-bearer"

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
