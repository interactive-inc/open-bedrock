import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { headcountPlanFactory } from "@/contexts/headcount-plan/interface/request-environment/headcount-plan-factory"
import { headcountPlanIdSchema } from "@/contexts/headcount-plan/interface/http/headcount-plan-input-schemas"
import { CaptureHeadcountPlanRecordAdapter } from "@/contexts/headcount-plan/infrastructure/adapters/capture-headcount-plan-record.adapter"
import { HeadcountPlanActorReadAdapter } from "@/contexts/headcount-plan/infrastructure/adapters/headcount-plan-actor-read.adapter"
import {
  HeadcountPlanForbiddenError,
  HeadcountPlanInputError,
  HeadcountPlanNotFoundError,
  HeadcountPlanConflictError,
  HeadcountPlanUnavailableError,
} from "@/contexts/headcount-plan/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** 人員計画記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createHeadcountPlanPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return headcountPlanFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: headcountPlanIdSchema,
        number: z.coerce.number().int().positive().safe().optional(),
      }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new HeadcountPlanForbiddenError()
      const request = c.req.valid("json")
      const headcountPlanId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "headcount-plan",
          recordKind: "headcount-plan-record",
          recordId: String(headcountPlanId),
          sourceNamespace,
          authorize: () => new HeadcountPlanActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureHeadcountPlanRecordAdapter(c).prepare({ headcountPlanId, sourceNamespace }),
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
            throw new HeadcountPlanInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new HeadcountPlanInputError({ message: "invalid preservation request" })
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
            throw new HeadcountPlanInputError({ message: submitted.message })
          case "forbidden":
            throw new HeadcountPlanForbiddenError()
          case "not_found":
            throw new HeadcountPlanNotFoundError()
          case "conflict":
            throw new HeadcountPlanConflictError()
          case "unavailable":
            throw new HeadcountPlanUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
