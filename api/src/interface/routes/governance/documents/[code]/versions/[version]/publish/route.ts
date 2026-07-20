import { GovernancePublication } from "@/application/governance/governance-publication"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import {
  parseGovernanceCode,
  parseGovernanceVersion,
} from "@/interface/routes/governance/governance-route-shared"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"

export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const code = parseGovernanceCode(c.req.param("code"))
  const version = parseGovernanceVersion(c.req.param("version"))
  if (code === null || version === null) throw new NotFoundError("governance version not found")
  const result = await new GovernancePublication(c).publish({ session, code, version })
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result
  return c.json(result, 200)
})
