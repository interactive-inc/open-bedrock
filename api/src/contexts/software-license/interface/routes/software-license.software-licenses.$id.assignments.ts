import { AssignLicense } from "@/contexts/software-license/application/license/assign-license"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import { licenseAssignmentSchema } from "@/contexts/software-license/domain/schemas/license-assignment.schema"
import { LicenseError } from "@/contexts/software-license/domain/errors"
import { toLicenseHttpException } from "@/contexts/software-license/interface/http/to-license-http-exception"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - 現在の操作権限と会社在籍を保存時にも検査する
export const POST = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  zValidator("param", z.object({ id: licenseIdSchema })),
  zValidator(
    "json",
    z
      .object({
        id: z.string().uuid(),
        employee_id: zEmployeeId,
        account_reference: z.string().trim().min(1).max(300).nullable().default(null),
        reason: z.string().trim().min(1).max(1000),
      })
      .strict(),
  ),
  async (c) => {
    const command = c.req.valid("json")
    const recorded = await new AssignLicense(c).run({
      id: command.id,
      licenseId: c.req.valid("param").id,
      employeeId: command.employee_id,
      accountReference: command.account_reference,
      reason: command.reason,
    })
    if (recorded instanceof LicenseError) throw toLicenseHttpException(recorded)
    return c.json(
      licenseAssignmentSchema.parse(recorded.assignment.props),
      recorded.isReplay ? 200 : 201,
    )
  },
)
