import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { leaveFactory } from "@/contexts/leave/interface/request-environment/leave-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { ReviewRecordRetirementAdapter } from "@system/infrastructure/adapters/records/review-record-retirement.adapter"
import { RecordRetirementReviewError } from "@system/infrastructure/adapters/records/errors"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import { SystemForbiddenError, SystemHTTPException } from "@system/interface/errors"

// @authorization service - 提案閲覧権限と現在のCompany判断資格で固定した撤去対象を取得する
export const GET = leaveFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({ planId: z.uuid(), number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator("query", z.strictObject({})),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new SystemForbiddenError()
    const reviewed = await new ReviewRecordRetirementAdapter({
      env: c.env,
      var: c.var,
      source: {
        planId: c.req.valid("param").planId,
        sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE ?? "",
        ownerContext: "leave",
      },
      prepareDecision: async (input) => {
        const decision = await prepareCompanyRecordProcedureDecision(c, input)
        if (decision instanceof CompanyConflictError)
          return new RecordRetirementReviewError("conflict")
        if (decision instanceof CompanyUnexpectedError)
          return new RecordRetirementReviewError("unavailable")
        return decision
      },
    }).execute({ authentication, number: c.req.valid("param").number })
    if (reviewed instanceof RecordRetirementReviewError) {
      const statuses: Readonly<
        Record<RecordRetirementReviewError["code"], 400 | 403 | 404 | 409 | 503>
      > = { invalid: 400, forbidden: 403, not_found: 404, conflict: 409, unavailable: 503 }
      throw new SystemHTTPException({
        status: statuses[reviewed.code],
        code: `record_retirement_${reviewed.code}`,
        detail: reviewed.message,
      })
    }
    return c.json(reviewed, 200)
  },
)
