import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { certificateRequestFactory } from "@/contexts/certificate-request/interface/request-environment/certificate-request-factory"
import { certificateRequestIdSchema } from "@/contexts/certificate-request/interface/http/certificate-request-input-schemas"
import { CaptureCertificateRequestRecordAdapter } from "@/contexts/certificate-request/infrastructure/adapters/capture-certificate-request-record.adapter"
import { CertificateRequestActorReadAdapter } from "@/contexts/certificate-request/infrastructure/adapters/certificate-request-actor-read.adapter"
import {
  CertificateRequestForbiddenError,
  CertificateRequestInputError,
  CertificateRequestNotFoundError,
  CertificateRequestConflictError,
  CertificateRequestUnavailableError,
} from "@/contexts/certificate-request/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** certificate request記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createCertificateRequestPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return certificateRequestFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({ id: certificateRequestIdSchema, number: z.coerce.number().int().positive().safe().optional() }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new CertificateRequestForbiddenError()
      const request = c.req.valid("json")
      const certificateRequestId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "certificate-request",
          recordKind: "certificate-request-record",
          recordId: String(certificateRequestId),
          sourceNamespace,
          authorize: () => new CertificateRequestActorReadAdapter(c).prepare(),
          capture: () => new CaptureCertificateRequestRecordAdapter(c).prepare({ certificateRequestId, sourceNamespace }),
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
            throw new CertificateRequestInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new CertificateRequestInputError({ message: "invalid preservation request" })
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
            throw new CertificateRequestInputError({ message: submitted.message })
          case "forbidden":
            throw new CertificateRequestForbiddenError()
          case "not_found":
            throw new CertificateRequestNotFoundError()
          case "conflict":
            throw new CertificateRequestConflictError()
          case "unavailable":
            throw new CertificateRequestUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
