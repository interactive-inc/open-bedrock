import { GovernancePublication } from "@/application/governance/governance-publication"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError, NotFoundError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { parseGovernanceCode } from "@/interface/utils/parse-governance-code"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"

export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const code = parseGovernanceCode(c.req.param("code"))
  if (code === null) throw new NotFoundError("governance document not found")
  const result = await new GovernancePublication(c).acknowledge({ session, code })
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result
  return c.json(result, 200)
})
