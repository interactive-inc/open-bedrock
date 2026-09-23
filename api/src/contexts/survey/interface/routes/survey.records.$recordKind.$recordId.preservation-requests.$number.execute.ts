import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  SurveyForbiddenError,
  SurveyInputError,
  SurveyNotFoundError,
  SurveyConflictError,
  SurveyUnavailableError,
} from "@/contexts/survey/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { surveyFactory } from "@/contexts/survey/interface/request-environment/survey-factory"
import { surveyRecordRouteSchema } from "@/contexts/survey/interface/http/survey-input-schemas"
import { RevalidateSurveyRecordSourceAdapter } from "@/contexts/survey/infrastructure/adapters/revalidate-survey-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = surveyFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    surveyRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new SurveyForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "survey",
        recordKind: c.req.valid("param").recordKind,
        recordId: c.req.valid("param").recordId,
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateSurveyRecordSourceAdapter({
            env: c.env,
            var: c.var,
            sourceNamespace,
          }).prepare(source),
      },
      prepareExecution: (input) => revalidateCompanyRecordPreservationExecution(c, input),
    }).execute({
      authentication,
      number: c.req.valid("param").number,
      proposalDigest: c.req.valid("json").proposal_digest,
    })
    if (result instanceof RecordPreservationExecutionError) {
      switch (result.code) {
        case "invalid":
          throw new SurveyInputError({ message: result.message })
        case "forbidden":
          throw new SurveyForbiddenError()
        case "not_found":
          throw new SurveyNotFoundError()
        case "conflict":
          throw new SurveyConflictError()
        case "unavailable":
          throw new SurveyUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
