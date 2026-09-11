import { parseLicenseCommandId } from "@/contexts/software-license/interface/http/parse-license-command-id"
import { CreateLicense } from "@/contexts/software-license/application/license/create-license"
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
  licenseListQuerySchema,
} from "@/contexts/software-license/interface/http/license-input-schemas"
import { licenseListResponseSchema } from "@/contexts/software-license/interface/http/response-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import {
  SoftwareLicenseForbiddenError,
  SoftwareLicenseUnavailableError,
} from "@/contexts/software-license/interface/errors"

// @authorization permission - 現在の全社閲覧権限を要求する
export const GET = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  zValidator("query", licenseListQuerySchema),
  async (c) => {
    if (!c.var.permissions.has("license:read:all") && !c.var.permissions.has("system:admin"))
      throw new SoftwareLicenseForbiddenError()
    const query = c.req.valid("query")
    const page = await new LicenseRepository(c).findMany({
      status: query.status ?? null,
      limit: query.limit,
      offset: query.offset,
    })
    if (page instanceof Error)
      throw new SoftwareLicenseUnavailableError({ message: "license list is unavailable" })
    return c.json(
      licenseListResponseSchema.parse({
        data: page.licenses.map(toLicenseResponse),
        total: page.total,
      }),
      200,
    )
  },
)

// @authorization service - 在籍と現在の操作権限を保存時にも検査する
export const POST = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  resolveLicenseSession,
  zValidator("header", z.object({ "idempotency-key": z.string() })),
  zValidator("json", licenseInputSchema),
  async (c) => {
    const session = c.var.licenseSession
    if (session === null) throw new SoftwareLicenseForbiddenError()
    const json = c.req.valid("json")
    const created = await new CreateLicense(c).run({
      session,
      commandId: parseLicenseCommandId(c.req.valid("header")["idempotency-key"]),
      license: {
        name: json.name,
        planName: json.plan_name ?? null,
        vendor: json.vendor ?? null,
        category: json.category ?? null,
        seats: json.seats ?? null,
        renewalDeadline: json.renewal_deadline ?? null,
        ownerEmployeeId: json.owner_employee_id ?? null,
        note: json.note ?? null,
      },
      createdAt: c.var.now().toISOString(),
    })
    if (created instanceof LicenseError) throw toLicenseHttpException(created)
    return c.json(toLicenseResponse(created), 201)
  },
)
