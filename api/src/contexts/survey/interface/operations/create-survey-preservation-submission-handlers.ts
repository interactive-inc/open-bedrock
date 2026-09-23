import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { surveyFactory } from "@/contexts/survey/interface/request-environment/survey-factory"
import { surveyRecordRouteSchema } from "@/contexts/survey/interface/http/survey-input-schemas"
import { CaptureSurveyRecordAdapter } from "@/contexts/survey/infrastructure/adapters/capture-survey-record.adapter"
import { SurveyActorReadAdapter } from "@/contexts/survey/infrastructure/adapters/survey-actor-read.adapter"
import {
  SurveyForbiddenError,
  SurveyInputError,
  SurveyNotFoundError,
  SurveyConflictError,
  SurveyUnavailableError,
} from "@/contexts/survey/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** survey記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createSurveyPreservationSubmissionHandlers(mode: "create" | "resubmit") {
  const requestSchema = z.strictObject({
    procedure_key: procedureKeySchema,
    conditions: recordPreservationRequestSchema,
  })
  const schemas = {
    create: requestSchema,
    resubmit: requestSchema.extend({
      previous_version: z.number().int().positive().safe(),
      previous_digest: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  }
  return surveyFactory.createHandlers(
    zValidator("param", surveyRecordRouteSchema),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new SurveyForbiddenError()
      const request = c.req.valid("json")
      const { recordKind, recordId } = c.req.valid("param")
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "survey",
          recordKind,
          recordId,
          sourceNamespace,
          authorize: () => new SurveyActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureSurveyRecordAdapter(c).prepare({ recordKind, recordId, sourceNamespace }),
        },
        prepareTask: (input) => prepareCompanyRecordProcedureTask(c, input),
      })
      const common = {
        authentication,
        procedureKey: request.procedure_key,
        conditions: request.conditions,
      }
      const submit = async () => {
        if (mode === "create") {
          const idempotencyKey = c.req.valid("header")["idempotency-key"]
          if (idempotencyKey === undefined)
            throw new SurveyInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new SurveyInputError({ message: "invalid preservation request" })
        return adapter.execute({
          ...common,
          revision: {
            mode: "resubmit",
            number,
            previousVersion: request.previous_version,
            previousDigest: request.previous_digest,
          },
        })
      }
      const submitted = await submit()
      if (submitted instanceof RecordPreservationSubmissionError) {
        switch (submitted.code) {
          case "invalid":
            throw new SurveyInputError({ message: submitted.message })
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
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
