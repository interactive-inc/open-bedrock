import { RebuildLifecycleProjections } from "@/application/employee-lifecycle/rebuild-lifecycle-projections"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { canManageLifecycleMigration } from "@/lib/employee-lifecycle/can-manage-lifecycle-migration"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/lib/factory"

export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  if (!canManageLifecycleMigration(session)) throw new ForbiddenError()
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
