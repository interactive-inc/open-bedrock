import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { disciplinaryActionFactory } from "@/contexts/disciplinary-action/interface/request-environment/disciplinary-action-factory"
import { disciplinaryActionIdSchema } from "@/contexts/disciplinary-action/interface/http/disciplinary-action-input-schemas"
import { CaptureDisciplinaryActionRecordAdapter } from "@/contexts/disciplinary-action/infrastructure/adapters/capture-disciplinary-action-record.adapter"
import { DisciplinaryActionActorReadAdapter } from "@/contexts/disciplinary-action/infrastructure/adapters/disciplinary-action-actor-read.adapter"
import {
  DisciplinaryActionForbiddenError,
  DisciplinaryActionInputError,
  DisciplinaryActionNotFoundError,
  DisciplinaryActionConflictError,
  DisciplinaryActionUnavailableError,
} from "@/contexts/disciplinary-action/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { submitSystemRecordPreservation } from "@system/interface/operations/submit-system-record-preservation"
import { RecordPreservationSubmissionError } from "@system/application/records/errors"

/** 懲戒記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createDisciplinaryActionPreservationSubmissionHandlers(
  mode: "create" | "resubmit",
) {
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
  return disciplinaryActionFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: disciplinaryActionIdSchema,
        number: z.coerce.number().int().positive().safe().optional(),
      }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new DisciplinaryActionForbiddenError()
      const request = c.req.valid("json")
      const disciplinaryActionId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapterContext: Parameters<typeof submitSystemRecordPreservation>[0] = {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "disciplinary-action",
          recordKind: "disciplinary-action-record",
          recordId: String(disciplinaryActionId),
          sourceNamespace,
          authorize: () => new DisciplinaryActionActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureDisciplinaryActionRecordAdapter(c).prepare({
              disciplinaryActionId,
              sourceNamespace,
            }),
        },
        prepareTask: (input) => prepareCompanyRecordProcedureTask(c, input),
      }
      const common = {
        authentication,
        procedureKey: request.procedure_key,
        conditions: request.conditions,
      }
      const submit = async () => {
        if (mode === "create") {
          const idempotencyKey = c.req.valid("header")["idempotency-key"]
          if (idempotencyKey === undefined)
            throw new DisciplinaryActionInputError({ message: "invalid preservation request" })
          return submitSystemRecordPreservation(adapterContext, {
            ...common,
            revision: { mode: "create", idempotencyKey },
          })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new DisciplinaryActionInputError({ message: "invalid preservation request" })
        return submitSystemRecordPreservation(adapterContext, {
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
            throw new DisciplinaryActionInputError({ message: submitted.message })
          case "forbidden":
            throw new DisciplinaryActionForbiddenError()
          case "not_found":
            throw new DisciplinaryActionNotFoundError()
          case "conflict":
            throw new DisciplinaryActionConflictError()
          case "unavailable":
            throw new DisciplinaryActionUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
