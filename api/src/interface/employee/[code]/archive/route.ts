import { ArchiveEmployee } from "@/application/employee-lifecycle/archive-employee"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateCodeParam } from "@/interface/shared/validate-code-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/lib/factory"

export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const result = await new ArchiveEmployee(c).run({
    session,
    employeeCode: validateCodeParam(c.req.param("code"), "employee"),
    archivedAt: c.env.NOW ?? new Date().toISOString(),
  })
  if (result instanceof ApplicationError) throw toHttpException(result)
  return c.json(result, 200)
})
