import { GovernancePublicationService } from "@/contexts/governance/application/governance-publication-service"
import { prepareGovernanceAudit } from "@/api/http/audit/prepare-governance-audit"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { parseGovernanceCode } from "@/api/http/utils/parse-governance-code"
import { parseGovernanceVersion } from "@/api/http/utils/parse-governance-version"
import { verifyBearer } from "@/api/http/verify-bearer"

// @authorization service - session を application service に渡して判定する
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const code = parseGovernanceCode(c.req.param("code"))
  const version = parseGovernanceVersion(c.req.param("version"))
  if (code === null || version === null) throw new NotFoundError("governance version not found")
  const result = await new GovernancePublicationService(c, (audit) =>
    prepareGovernanceAudit({ c, ...audit }),
  ).submitReview({ session, code, version })
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result
  return c.json(result, 200)
})
