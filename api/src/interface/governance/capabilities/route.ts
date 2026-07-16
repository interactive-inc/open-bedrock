import { GovernanceRepository } from "@/infrastructure/governance/governance-repository"
import { factory } from "@/lib/factory"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  if (
    !session.permissions.has("governance:read") &&
    !session.permissions.has("governance:manage")
  ) {
    throw new ForbiddenError()
  }
  const data = await new GovernanceRepository(c).listCapabilities()
  if (data instanceof Error) throw new InternalError("failed to list governance capabilities")
  return c.json({ data }, 200)
})
