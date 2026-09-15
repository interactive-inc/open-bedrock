import { zAppTrainingRetirementRequest } from "@/contexts/training/interface/http/response-schemas"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { trainingFactory } from "@/contexts/training/interface/request-environment/training-factory"
import { SubmitTrainingRetirementRequestAdapter } from "@/contexts/training/infrastructure/adapters/submit-training-retirement-request.adapter"
import {
  TrainingRetirementForbiddenError,
  TrainingRetirementConflictError,
} from "@/contexts/training/application/errors"
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
export const POST = trainingFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", z.strictObject({ planId: z.uuid() })),
  zValidator("header", z.object({ "idempotency-key": z.uuid() })),
  zValidator(
    "json",
    z.strictObject({
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
    const submitted = await new SubmitTrainingRetirementRequestAdapter(c).execute(
      {
        revision: { mode: "create", id: c.req.valid("header")["idempotency-key"] },
        planId: c.req.valid("param").planId,
        planDigest: request.plan_digest,
        procedureKey: request.procedure_key,
        reason: request.reason,
        sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE,
      },
      token,
    )
    if (
      submitted instanceof TrainingRetirementForbiddenError ||
      submitted instanceof CompanyForbiddenError ||
      submitted instanceof ForbiddenError
    )
      throw new SystemForbiddenError()
    if (submitted instanceof TrainingRetirementConflictError)
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
      zAppTrainingRetirementRequest.parse(submitted.request),
      submitted.created ? 201 : 200,
    )
  },
)
