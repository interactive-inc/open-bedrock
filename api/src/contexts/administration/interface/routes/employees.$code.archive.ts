import { ArchiveEmployee } from "@/contexts/administration/application/employee-lifecycle/archive-employee"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateCodeParam } from "@/lib/http/validate-code-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/api/http/factory"

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
