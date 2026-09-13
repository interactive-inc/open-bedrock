import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import { CaptureLicenseRecordAdapter } from "@/contexts/software-license/infrastructure/adapters/capture-license-record.adapter"
import { LicenseActorReadAdapter } from "@/contexts/software-license/infrastructure/adapters/license-actor-read.adapter"
import {
  SoftwareLicenseForbiddenError,
  SoftwareLicenseInputError,
  SoftwareLicenseNotFoundError,
  SoftwareLicenseConflictError,
  SoftwareLicenseUnavailableError,
} from "@/contexts/software-license/interface/errors"
import { PrepareCompanyRecordProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-task.adapter"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** 台帳の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createLicensePreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return softwareLicenseFactory.createHandlers(
    ensureLicenseEnabled,
    zValidator(
      "param",
      z.strictObject({ id: licenseIdSchema, number: licenseIdSchema.optional() }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new SoftwareLicenseForbiddenError()
      const request = c.req.valid("json")
      const licenseId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "software-license",
          recordKind: "license-record",
          recordId: String(licenseId),
          sourceNamespace,
          authorize: () => new LicenseActorReadAdapter(c).prepare(),
          capture: () => new CaptureLicenseRecordAdapter(c).prepare({ licenseId, sourceNamespace }),
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
            throw new SoftwareLicenseInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new SoftwareLicenseInputError({ message: "invalid preservation request" })
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
            throw new SoftwareLicenseInputError({ message: submitted.message })
          case "forbidden":
            throw new SoftwareLicenseForbiddenError()
          case "not_found":
            throw new SoftwareLicenseNotFoundError()
          case "conflict":
            throw new SoftwareLicenseConflictError()
          case "unavailable":
            throw new SoftwareLicenseUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
