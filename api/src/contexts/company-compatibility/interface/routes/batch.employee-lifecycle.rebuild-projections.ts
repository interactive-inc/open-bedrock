import { RebuildLifecycleProjections } from "@/contexts/company-compatibility/application/employee-lifecycle/rebuild-lifecycle-projections"
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"

// @authorization permission - 権限キーで判定する
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  if (!session.hasPermission("batch:view")) throw new ForbiddenError()
  const result = await new RebuildLifecycleProjections(c).run()
  if (result instanceof ApplicationError) throw toHttpException(result)
  return c.json(
    {
      business_date: result.businessDate,
      employees_changed: result.employeesChanged,
      memberships_changed: result.membershipsChanged,
    },
    200,
  )
})
