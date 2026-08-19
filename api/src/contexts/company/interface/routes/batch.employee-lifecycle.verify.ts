import { VerifyLifecycleMigration } from "@/contexts/company/application/employee-lifecycle/verify-lifecycle-migration"
import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const inputSchema = z.object({
  baseline_on: z.string(),
  time_zone: z.string(),
  legacy_source_fingerprint: z.string(),
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
    const result = await new VerifyLifecycleMigration(c).run({
      baselineOn: input.baseline_on,
      timeZone: input.time_zone,
      legacySourceFingerprint: input.legacy_source_fingerprint,
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    return c.json({ status: result.status, employees_verified: result.employeesVerified }, 200)
  },
)
