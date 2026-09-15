import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { announcementFactory } from "@/contexts/announcement/interface/request-environment/announcement-factory"
import { announcementIdSchema } from "@/contexts/announcement/interface/http/announcement-input-schemas"
import { CaptureAnnouncementRecordAdapter } from "@/contexts/announcement/infrastructure/adapters/capture-announcement-record.adapter"
import { AnnouncementActorReadAdapter } from "@/contexts/announcement/infrastructure/adapters/announcement-actor-read.adapter"
import {
  AnnouncementForbiddenError,
  AnnouncementInputError,
  AnnouncementNotFoundError,
  AnnouncementConflictError,
  AnnouncementUnavailableError,
} from "@/contexts/announcement/interface/errors"
import { PrepareCompanyRecordProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-task.adapter"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** アナウンスの取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createAnnouncementPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return announcementFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({ id: announcementIdSchema, number: announcementIdSchema.optional() }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new AnnouncementForbiddenError()
      const request = c.req.valid("json")
      const announcementId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "announcement",
          recordKind: "announcement-record",
          recordId: String(announcementId),
          sourceNamespace,
          authorize: () => new AnnouncementActorReadAdapter(c).prepare(),
          capture: () => new CaptureAnnouncementRecordAdapter(c).prepare({ announcementId, sourceNamespace }),
        },
        prepareTask: (input) => new PrepareCompanyRecordProcedureTaskAdapter(c).prepare(input),
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
            throw new AnnouncementInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new AnnouncementInputError({ message: "invalid preservation request" })
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
            throw new AnnouncementInputError({ message: submitted.message })
          case "forbidden":
            throw new AnnouncementForbiddenError()
          case "not_found":
            throw new AnnouncementNotFoundError()
          case "conflict":
            throw new AnnouncementConflictError()
          case "unavailable":
            throw new AnnouncementUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
