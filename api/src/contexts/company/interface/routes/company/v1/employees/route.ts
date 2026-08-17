import { ReadEmployeeDirectory } from "@/contexts/company/application/workforce/read-employee-directory"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/workforce-id"
import { EmployeeDirectoryReadRepository } from "@/contexts/company/infrastructure/workforce/employee-directory-read.repository"
import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { requireCanonicalCompany } from "@/contexts/company/interface/utils/require-canonical-company"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppCompanyEmployeeDirectory } from "@/lib/app-schemas"
import { UnavailableError, ValidationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const employeeIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)
const querySchema = z.strictObject({
  employee_id: z.preprocess(
    (value) => (typeof value === "string" ? [value] : value),
    z.array(employeeIdSchema).min(1).max(100),
  ),
})

// @authorization permission - 全社Workforce読取permissionで判定する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", querySchema),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    if (!session.hasPermission("employee:lifecycle:read:all")) throw new ForbiddenError()
    await requireCanonicalCompany(c)

    const employeeIds = c.req
      .valid("query")
      .employee_id.map((employeeId) => restoreWorkforceId("employee", employeeId))
    const result = await new ReadEmployeeDirectory({
      port: new EmployeeDirectoryReadRepository({ context: c }),
    }).execute(employeeIds)
    if (result.kind === "invalid_query") {
      throw toHttpException(
        new ValidationError("employee directory query is invalid", result.error.code),
      )
    }
    if (result.kind === "invalid_directory") {
      throw toHttpException(
        new UnavailableError("employee directory is inconsistent", result.error.code),
      )
    }
    if (result.kind === "unavailable") {
      throw toHttpException(
        new UnavailableError("employee directory is unavailable", "company_directory_unavailable", {
          cause: result.cause,
        }),
      )
    }

    return c.json(
      zAppCompanyEmployeeDirectory.parse({
        employees: result.employees.map((employee) => ({
          employee_id: employee.id,
          official_name: employee.officialName,
          employee_code: employee.employeeCode,
          email: employee.email,
          phone: employee.phone,
        })),
        missing_employee_ids: result.missingEmployeeIds,
      }),
      200,
    )
  },
)
