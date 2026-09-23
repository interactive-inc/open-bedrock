import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { rentalReservationFactory } from "@/contexts/rental/interface/request-environment/rental-factory"
import { rentalReservationIdSchema } from "@/contexts/rental/interface/http/rental-input-schemas"
import { CaptureRentalReservationRecordAdapter } from "@/contexts/rental/infrastructure/adapters/capture-rental-reservation-record.adapter"
import { RentalReservationActorReadAdapter } from "@/contexts/rental/infrastructure/adapters/rental-reservation-actor-read.adapter"
import {
  RentalReservationForbiddenError,
  RentalReservationInputError,
  RentalReservationNotFoundError,
  RentalReservationConflictError,
  RentalReservationUnavailableError,
} from "@/contexts/rental/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** rental reservation記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createRentalReservationPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return rentalReservationFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({ id: rentalReservationIdSchema, number: z.coerce.number().int().positive().safe().optional() }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new RentalReservationForbiddenError()
      const request = c.req.valid("json")
      const rentalReservationId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "rental",
          recordKind: "rental-reservation-record",
          recordId: String(rentalReservationId),
          sourceNamespace,
          authorize: () => new RentalReservationActorReadAdapter(c).prepare(),
          capture: () => new CaptureRentalReservationRecordAdapter(c).prepare({ rentalReservationId, sourceNamespace }),
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
            throw new RentalReservationInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new RentalReservationInputError({ message: "invalid preservation request" })
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
            throw new RentalReservationInputError({ message: submitted.message })
          case "forbidden":
            throw new RentalReservationForbiddenError()
          case "not_found":
            throw new RentalReservationNotFoundError()
          case "conflict":
            throw new RentalReservationConflictError()
          case "unavailable":
            throw new RentalReservationUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
