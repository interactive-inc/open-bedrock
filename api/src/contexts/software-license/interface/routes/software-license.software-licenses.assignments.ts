import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import { licenseAssignmentSchema } from "@/contexts/software-license/domain/schemas/license-assignment.schema"
import { LicenseAssignmentRepository } from "@/contexts/software-license/infrastructure/repositories/license-assignment.repository"
import { zValidator } from "@hono/zod-validator"
import {
  SoftwareLicenseForbiddenError,
  SoftwareLicenseUnavailableError,
} from "@/contexts/software-license/interface/errors"
import { z } from "zod"

// @authorization permission - 利用者一覧は全社閲覧権限を要求する
export const GET = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  zValidator(
    "query",
    z.object({
      license_id: licenseIdSchema.optional(),
      employee_id: zEmployeeId.optional(),
      state: z.enum(["assigned", "released"]).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).max(100000).default(0),
    }),
  ),
  async (c) => {
    if (!c.var.permissions.has("license:read:all") && !c.var.permissions.has("system:admin"))
      throw new SoftwareLicenseForbiddenError()
    const query = c.req.valid("query")
    const assignments = await new LicenseAssignmentRepository(c).findMany({
      licenseId: query.license_id ?? null,
      employeeId: query.employee_id ?? null,
      state: query.state ?? null,
      limit: query.limit + 1,
      offset: query.offset,
    })
    if (assignments instanceof Error) throw new SoftwareLicenseUnavailableError()
    const page = assignments.slice(0, query.limit)
    const employees = await new CompanyEmployeeDirectoryReadAdapter({
      env: {
        DB: c.env.DB,
        COMPANY_TIME_ZONE: c.env.COMPANY_TIME_ZONE,
        NOW: c.var.now().toISOString(),
      },
    }).findForEmployeeIds(page.map((assignment) => assignment.props.employee_id))
    if (employees instanceof Error) throw new SoftwareLicenseUnavailableError()
    return c.json(
      z
        .object({
          data: z.array(
            licenseAssignmentSchema.safeExtend({ employee_name: z.string().nullable() }),
          ),
          has_more: z.boolean(),
        })
        .parse({
          data: page.map((assignment) => ({
            ...assignment.props,
            employee_name:
              employees.find((employee) => employee.id === assignment.props.employee_id)
                ?.officialName ?? null,
          })),
          has_more: assignments.length > query.limit,
        }),
      200,
    )
  },
)
