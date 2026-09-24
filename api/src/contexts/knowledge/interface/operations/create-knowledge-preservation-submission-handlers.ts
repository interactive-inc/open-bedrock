import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { knowledgeFactory } from "@/contexts/knowledge/interface/request-environment/knowledge-factory"
import { knowledgeIdSchema } from "@/contexts/knowledge/interface/http/knowledge-input-schemas"
import { CaptureKnowledgeRecordAdapter } from "@/contexts/knowledge/infrastructure/adapters/capture-knowledge-article-record.adapter"
import { KnowledgeActorReadAdapter } from "@/contexts/knowledge/infrastructure/adapters/knowledge-actor-read.adapter"
import {
  KnowledgeForbiddenError,
  KnowledgeInputError,
  KnowledgeNotFoundError,
  KnowledgeConflictError,
  KnowledgeUnavailableError,
} from "@/contexts/knowledge/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { submitSystemRecordPreservation } from "@system/interface/operations/submit-system-record-preservation"
import { RecordPreservationSubmissionError } from "@system/application/records/errors"

/** knowledge記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createKnowledgePreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return knowledgeFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: knowledgeIdSchema,
        number: z.coerce.number().int().positive().safe().optional(),
      }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new KnowledgeForbiddenError()
      const request = c.req.valid("json")
      const knowledgeId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapterContext: Parameters<typeof submitSystemRecordPreservation>[0] = {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "knowledge",
          recordKind: "knowledge-article-record",
          recordId: String(knowledgeId),
          sourceNamespace,
          authorize: () => new KnowledgeActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureKnowledgeRecordAdapter(c).prepare({
              articleId: knowledgeId,
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
            throw new KnowledgeInputError({ message: "invalid preservation request" })
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
          throw new KnowledgeInputError({ message: "invalid preservation request" })
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
            throw new KnowledgeInputError({ message: submitted.message })
          case "forbidden":
            throw new KnowledgeForbiddenError()
          case "not_found":
            throw new KnowledgeNotFoundError()
          case "conflict":
            throw new KnowledgeConflictError()
          case "unavailable":
            throw new KnowledgeUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
