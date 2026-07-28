import { PreflightLifecycleMigration } from "@/application/employee-lifecycle/preflight-lifecycle-migration"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/interface/utils/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const inputSchema = z.object({
  baseline_on: z.string(),
  time_zone: z.string(),
})

// @authorization permission - 権限キーで判定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", inputSchema),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    if (!session.hasPermission("batch:view")) throw new ForbiddenError()

    const input = c.req.valid("json")
    const result = await new PreflightLifecycleMigration(c).run({
      baselineOn: input.baseline_on,
      timeZone: input.time_zone,
    })
    if (result instanceof ApplicationError) throw toHttpException(result)

    return c.json(
      {
        baseline_on: result.baselineOn,
        time_zone: result.timeZone,
        legacy_source_fingerprint: result.legacySourceFingerprint,
        employee_count: result.employeeCount,
        department_count: result.departmentCount,
        issues: result.issues.map((issue) => ({
          code: issue.code,
          employee_code: issue.employeeCode,
          department_code: issue.departmentCode,
        })),
      },
      200,
    )
  },
)
