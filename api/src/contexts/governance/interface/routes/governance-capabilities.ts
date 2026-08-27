import { GovernanceAdapter } from "@/contexts/governance/infrastructure/adapters/governance.adapter"
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
  const data = await new GovernanceAdapter(c).listCapabilities()
  if (data instanceof Error) throw new InternalError("failed to list governance capabilities")
  return c.json({ data }, 200)
})
