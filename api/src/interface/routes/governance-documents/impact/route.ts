import { AnalyzeGovernanceImpact } from "@/application/governance/analyze-governance-impact"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const result = await new AnalyzeGovernanceImpact(c).run(session)
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result
  return c.json(result, 200)
})
