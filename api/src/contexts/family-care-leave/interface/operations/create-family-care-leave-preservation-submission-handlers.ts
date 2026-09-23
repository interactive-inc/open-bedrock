import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { familyCareLeaveFactory } from "@/contexts/family-care-leave/interface/request-environment/family-care-leave-factory"
import { familyCareLeaveIdSchema } from "@/contexts/family-care-leave/interface/http/family-care-leave-input-schemas"
import { CaptureFamilyCareLeaveRecordAdapter } from "@/contexts/family-care-leave/infrastructure/adapters/capture-family-care-leave-record.adapter"
import { FamilyCareLeaveActorReadAdapter } from "@/contexts/family-care-leave/infrastructure/adapters/family-care-leave-actor-read.adapter"
import {
  FamilyCareLeaveForbiddenError,
  FamilyCareLeaveInputError,
  FamilyCareLeaveNotFoundError,
  FamilyCareLeaveConflictError,
  FamilyCareLeaveUnavailableError,
} from "@/contexts/family-care-leave/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** family care leave記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createFamilyCareLeavePreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return familyCareLeaveFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: familyCareLeaveIdSchema,
        number: z.coerce.number().int().positive().safe().optional(),
      }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new FamilyCareLeaveForbiddenError()
      const request = c.req.valid("json")
      const familyCareLeaveId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "family-care-leave",
          recordKind: "family-care-leave-record",
          recordId: String(familyCareLeaveId),
          sourceNamespace,
          authorize: () => new FamilyCareLeaveActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureFamilyCareLeaveRecordAdapter(c).prepare({
              familyCareLeaveId,
              sourceNamespace,
            }),
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
            throw new FamilyCareLeaveInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new FamilyCareLeaveInputError({ message: "invalid preservation request" })
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
            throw new FamilyCareLeaveInputError({ message: submitted.message })
          case "forbidden":
            throw new FamilyCareLeaveForbiddenError()
          case "not_found":
            throw new FamilyCareLeaveNotFoundError()
          case "conflict":
            throw new FamilyCareLeaveConflictError()
          case "unavailable":
            throw new FamilyCareLeaveUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
