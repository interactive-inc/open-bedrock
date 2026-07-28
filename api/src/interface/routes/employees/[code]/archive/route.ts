import { ArchiveEmployee } from "@/application/employee-lifecycle/archive-employee"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateCodeParam } from "@/interface/utils/validate-code-param"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/interface/utils/factory"

// @authorization service - session を application service に渡して判定する
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
