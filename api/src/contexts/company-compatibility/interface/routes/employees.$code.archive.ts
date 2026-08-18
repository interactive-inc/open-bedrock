import { ArchiveEmployee } from "@/contexts/company-compatibility/application/employee-lifecycle/archive-employee"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { validateCodeParam } from "@/contexts/company-compatibility/interface/utils/validate-code-param"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"

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
