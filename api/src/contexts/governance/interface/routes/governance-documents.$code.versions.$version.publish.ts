import { GovernancePublication } from "@/contexts/governance/application/governance-publication"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { NotFoundError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { parseGovernanceCode } from "@/contexts/company/interface/utils/parse-governance-code"
import { parseGovernanceVersion } from "@/contexts/company/interface/utils/parse-governance-version"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"

// @authorization service - session を application service に渡して判定する
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
