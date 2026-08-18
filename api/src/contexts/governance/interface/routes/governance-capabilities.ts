import { GovernanceRepository } from "@/contexts/governance/infrastructure/governance-repository"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import {
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"

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
  const data = await new GovernanceRepository(c).listCapabilities()
  if (data instanceof Error) throw new InternalError("failed to list governance capabilities")
  return c.json({ data }, 200)
})
