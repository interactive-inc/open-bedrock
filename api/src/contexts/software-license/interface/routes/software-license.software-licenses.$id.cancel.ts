import { parseLicenseRevision } from "@/contexts/software-license/interface/http/parse-license-revision"
import { CancelLicense } from "@/contexts/software-license/application/license/cancel-license"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { resolveLicenseSession } from "@/contexts/software-license/interface/middlewares/resolve-license-session"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { LicenseError } from "@/contexts/software-license/domain/errors"
import { toLicenseHttpException } from "@/contexts/software-license/interface/http/to-license-http-exception"
import { toLicenseResponse } from "@/contexts/software-license/interface/http/to-license-response"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import { zValidator } from "@hono/zod-validator"
import { SoftwareLicenseForbiddenError } from "@/contexts/software-license/interface/errors"
import { z } from "zod"

// @authorization service - 利用者の割当が残る契約の解約を拒否する
export const POST = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  resolveLicenseSession,
  zValidator("param", z.object({ id: licenseIdSchema })),
  async (c) => {
    const session = c.var.licenseSession
    if (session === null) throw new SoftwareLicenseForbiddenError()
    const updated = await new CancelLicense(c).run({
      session,
      expectedRevision: parseLicenseRevision(c.req.header("if-match")),
      id: c.req.valid("param").id,
    })
    if (updated instanceof LicenseError) throw toLicenseHttpException(updated)
    return c.json(toLicenseResponse(updated), 200)
  },
)
