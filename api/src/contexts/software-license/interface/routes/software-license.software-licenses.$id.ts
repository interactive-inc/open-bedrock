import { parseLicenseRevision } from "@/contexts/software-license/interface/http/parse-license-revision"
import { UpdateLicense } from "@/contexts/software-license/application/license/update-license"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { resolveLicenseSession } from "@/contexts/software-license/interface/middlewares/resolve-license-session"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { LicenseRepository } from "@/contexts/software-license/infrastructure/repositories/license/license.repository"
import { LicenseError } from "@/contexts/software-license/domain/errors"
import { toLicenseHttpException } from "@/contexts/software-license/interface/http/to-license-http-exception"
import { toLicenseResponse } from "@/contexts/software-license/interface/http/to-license-response"
import {
  licenseInputSchema,
  licenseIdSchema,
} from "@/contexts/software-license/interface/http/license-input-schemas"
import { zValidator } from "@hono/zod-validator"
import {
  SoftwareLicenseForbiddenError,
  SoftwareLicenseNotFoundError,
  SoftwareLicenseUnavailableError,
} from "@/contexts/software-license/interface/errors"
import { z } from "zod"

// @authorization permission - 全社閲覧権限を要求する
export const GET = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  zValidator("param", z.object({ id: licenseIdSchema })),
  async (c) => {
    if (!c.var.permissions.has("license:read:all") && !c.var.permissions.has("system:admin"))
      throw new SoftwareLicenseForbiddenError()
    const license = await new LicenseRepository(c).find(c.req.valid("param").id)
    if (license instanceof Error) throw new SoftwareLicenseUnavailableError()
    if (license === null) throw new SoftwareLicenseNotFoundError()
    c.header("ETag", `"${license.revision}"`)
    return c.json(toLicenseResponse(license), 200)
  },
)

// @authorization service - 在籍と現在の操作権限を保存時にも検査する
export const PUT = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  resolveLicenseSession,
  zValidator("param", z.object({ id: licenseIdSchema })),
  zValidator("json", licenseInputSchema),
  async (c) => {
    const session = c.var.licenseSession
    if (session === null) throw new SoftwareLicenseForbiddenError()
    const json = c.req.valid("json")
    const updated = await new UpdateLicense(c).run({
      session,
      expectedRevision: parseLicenseRevision(c.req.header("if-match")),
      id: c.req.valid("param").id,
      details: {
        name: json.name,
        planName: json.plan_name,
        vendor: json.vendor ?? null,
        category: json.category ?? null,
        seats: json.seats ?? null,
        renewalDeadline: json.renewal_deadline ?? null,
        ownerEmployeeId: json.owner_employee_id ?? null,
        note: json.note ?? null,
      },
    })
    if (updated instanceof LicenseError) throw toLicenseHttpException(updated)
    return c.json(toLicenseResponse(updated), 200)
  },
)
