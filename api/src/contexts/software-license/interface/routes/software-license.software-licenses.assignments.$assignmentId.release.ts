import { ReleaseLicenseAssignment } from "@/contexts/software-license/application/license/release-license-assignment"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { licenseAssignmentSchema } from "@/contexts/software-license/domain/schemas/license-assignment.schema"
import { LicenseError } from "@/contexts/software-license/domain/errors"
import { toLicenseHttpException } from "@/contexts/software-license/interface/http/to-license-http-exception"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - 解除の記録者にも現在の権限と在籍を要求する
export const POST = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  zValidator("param", z.object({ assignmentId: z.string().uuid() })),
  zValidator("json", z.object({ reason: z.string().trim().min(1).max(1000) }).strict()),
  async (c) => {
    const released = await new ReleaseLicenseAssignment(c).run({
      id: c.req.valid("param").assignmentId,
      reason: c.req.valid("json").reason,
    })
    if (released instanceof LicenseError) throw toLicenseHttpException(released)
    return c.json(licenseAssignmentSchema.parse(released.props), 200)
  },
)
