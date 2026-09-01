import { PERMISSION_KEYS } from "@/api/http/permissions/permission-key.catalog"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { readGovernanceImpact } from "@/contexts/governance/interface/http/read-governance-impact"
import { readTrainingCourseCodeSet } from "@/contexts/training/interface/http/training-courses/read-training-course-code-set"

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()

  const result = await readGovernanceImpact(c, session, {
    permission: new Set<string>(PERMISSION_KEYS),
    training: await readTrainingCourseCodeSet(c),
  })
  if (result instanceof ApplicationError) throw toHttpException(result)
  if (result instanceof Error) throw result

  return c.json(result, 200)
})
