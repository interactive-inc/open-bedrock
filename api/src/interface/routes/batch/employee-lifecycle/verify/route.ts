import { VerifyLifecycleMigration } from "@/application/employee-lifecycle/verify-lifecycle-migration"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { canManageLifecycleMigration } from "@/lib/employee-lifecycle/can-manage-lifecycle-migration"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/lib/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const inputSchema = z.object({
  baseline_on: z.string(),
  time_zone: z.string(),
  legacy_source_fingerprint: z.string(),
})

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", inputSchema),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    if (!canManageLifecycleMigration(session)) throw new ForbiddenError()
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
