import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { documentFactory } from "@/contexts/document/interface/request-environment/document-factory"
import { documentIdSchema } from "@/contexts/document/interface/http/document-input-schemas"
import { CaptureDocumentRecordAdapter } from "@/contexts/document/infrastructure/adapters/capture-document-record.adapter"
import { DocumentActorReadAdapter } from "@/contexts/document/infrastructure/adapters/document-actor-read.adapter"
import {
  DocumentForbiddenError,
  DocumentInputError,
  DocumentNotFoundError,
  DocumentConflictError,
  DocumentUnavailableError,
} from "@/contexts/document/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** document記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createDocumentPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return documentFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: documentIdSchema,
        number: z.coerce.number().int().positive().safe().optional(),
      }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new DocumentForbiddenError()
      const request = c.req.valid("json")
      const documentId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "document",
          recordKind: "document-record",
          recordId: String(documentId),
          sourceNamespace,
          authorize: () => new DocumentActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureDocumentRecordAdapter(c).prepare({ documentId, sourceNamespace }),
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
            throw new DocumentInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new DocumentInputError({ message: "invalid preservation request" })
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
            throw new DocumentInputError({ message: submitted.message })
          case "forbidden":
            throw new DocumentForbiddenError()
          case "not_found":
            throw new DocumentNotFoundError()
          case "conflict":
            throw new DocumentConflictError()
          case "unavailable":
            throw new DocumentUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
