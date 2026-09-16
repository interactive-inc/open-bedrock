import { zAppRingiRetirementRequest } from "@/contexts/ringi/interface/http/response-schemas"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { ringiFactory } from "@/contexts/ringi/interface/request-environment/ringi-factory"
import { SubmitRingiRetirementRequestAdapter } from "@/contexts/ringi/infrastructure/adapters/submit-ringi-retirement-request.adapter"
import {
  RingiRetirementForbiddenError,
  RingiRetirementConflictError,
} from "@/contexts/ringi/application/errors"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import { ForbiddenError } from "@/lib/errors"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import {
  SystemForbiddenError,
  SystemHTTPException,
  SystemStepUpRequiredError,
} from "@system/interface/errors"

// @authorization service - 人の再認証と全件保全条件を検査し、会社資格から判断候補を解決する
export const POST = ringiFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator(
    "param",
    z.strictObject({ planId: z.uuid(), number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator(
    "json",
    z.strictObject({
      previous_version: z.number().int().positive().safe(),
      previous_digest: z.string().regex(/^[0-9a-f]{64}$/),
      plan_digest: z.string().regex(/^[0-9a-f]{64}$/),
      procedure_key: procedureKeySchema,
      reason: z.string().trim().min(1).max(3000),
    }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const token = c.req.header("x-system-step-up")
    if (token === undefined) throw new SystemStepUpRequiredError()
    const request = c.req.valid("json")
    const submitted = await new SubmitRingiRetirementRequestAdapter(c).execute(
      {
        revision: {
          mode: "resubmit",
          number: c.req.valid("param").number,
          previousVersion: request.previous_version,
          previousDigest: request.previous_digest,
        },
        planId: c.req.valid("param").planId,
        planDigest: request.plan_digest,
        procedureKey: request.procedure_key,
        reason: request.reason,
        sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE,
      },
      token,
    )
    if (
      submitted instanceof RingiRetirementForbiddenError ||
      submitted instanceof CompanyForbiddenError ||
      submitted instanceof ForbiddenError
    )
      throw new SystemForbiddenError()
    if (submitted instanceof RingiRetirementConflictError)
      throw new SystemHTTPException({
        status: 409,
        code: "record_retirement_conflict",
        detail: "Retirement request conflicts with the saved operation",
      })
    if (submitted instanceof Error)
      throw new SystemHTTPException({
        status: 503,
        code: "record_retirement_unavailable",
        detail: "Retirement request could not be submitted",
      })
    return c.json(
      zAppRingiRetirementRequest.parse(submitted.request),
      submitted.created ? 201 : 200,
    )
  },
)
