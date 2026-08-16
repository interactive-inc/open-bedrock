import { AnalyzeGovernanceImpact } from "@/contexts/governance/application/analyze-governance-impact"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { trainingCourses } from "@/contexts/training/infrastructure/schema/training"

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const training = await c.var.database.select({ code: trainingCourses.code }).from(trainingCourses)
  const result = await new AnalyzeGovernanceImpact(c).run(session, {
    training: new Set(training.map((item) => item.code)),
  })
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result
  return c.json(result, 200)
})
