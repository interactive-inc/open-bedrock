import { zAppBusinessTripRetirementExecution } from "@/contexts/business-trip/interface/http/response-schemas"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { businessTripFactory } from "@/contexts/business-trip/interface/request-environment/business-trip-factory"
import { ExecuteBusinessTripRetirementAdapter } from "@/contexts/business-trip/infrastructure/adapters/execute-business-trip-retirement.adapter"
import {
  BusinessTripRetirementForbiddenError,
  BusinessTripRetirementConflictError,
} from "@/contexts/business-trip/application/errors"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import { ForbiddenError } from "@/lib/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import {
  SystemForbiddenError,
  SystemHTTPException,
  SystemStepUpRequiredError,
} from "@system/interface/errors"

// @authorization service - 人の再認証と全件保全条件を検査し、人の承認資格を再検査して撤去を確定する
export const POST = businessTripFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator(
    "param",
    z.strictObject({ planId: z.uuid(), number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator(
    "json",
    z.strictObject({
      proposal_version: z.number().int().positive().safe(),
      proposal_digest: z.string().regex(/^[0-9a-f]{64}$/),
      plan_digest: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const token = c.req.header("x-system-step-up")
    if (token === undefined) throw new SystemStepUpRequiredError()
    const request = c.req.valid("json")
    const submitted = await new ExecuteBusinessTripRetirementAdapter(c).execute(
      {
        number: c.req.valid("param").number,
        proposalVersion: request.proposal_version,
        proposalDigest: request.proposal_digest,
        planId: c.req.valid("param").planId,
        planDigest: request.plan_digest,
        sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE,
      },
      token,
    )
    if (
      submitted instanceof BusinessTripRetirementForbiddenError ||
      submitted instanceof CompanyForbiddenError ||
      submitted instanceof ForbiddenError
    )
      throw new SystemForbiddenError()
    if (submitted instanceof BusinessTripRetirementConflictError)
      throw new SystemHTTPException({
        status: 409,
        code: "record_retirement_conflict",
        detail: "Retirement request conflicts with the saved operation",
      })
    if (submitted instanceof Error)
      throw new SystemHTTPException({
        status: 503,
        code: "record_retirement_unavailable",
        detail: "Retirement could not be finalized",
      })
    return c.json(zAppBusinessTripRetirementExecution.parse(submitted), 200)
  },
)
