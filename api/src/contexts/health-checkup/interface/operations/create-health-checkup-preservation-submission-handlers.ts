import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { healthCheckupFactory } from "@/contexts/health-checkup/interface/request-environment/health-checkup-factory"
import { healthCheckupIdSchema } from "@/contexts/health-checkup/interface/http/health-checkup-input-schemas"
import { CaptureHealthCheckupRecordAdapter } from "@/contexts/health-checkup/infrastructure/adapters/capture-health-checkup-record.adapter"
import { HealthCheckupActorReadAdapter } from "@/contexts/health-checkup/infrastructure/adapters/health-checkup-actor-read.adapter"
import {
  HealthCheckupForbiddenError,
  HealthCheckupInputError,
  HealthCheckupNotFoundError,
  HealthCheckupConflictError,
  HealthCheckupUnavailableError,
} from "@/contexts/health-checkup/interface/errors"
import { PrepareCompanyRecordProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-task.adapter"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** 健康診断実施記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createHealthCheckupPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return healthCheckupFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: healthCheckupIdSchema,
        number: z.coerce.number().int().positive().safe().optional(),
      }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new HealthCheckupForbiddenError()
      const request = c.req.valid("json")
      const healthCheckupId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "health-checkup",
          recordKind: "health-checkup-record",
          recordId: String(healthCheckupId),
          sourceNamespace,
          authorize: () => new HealthCheckupActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureHealthCheckupRecordAdapter(c).prepare({ healthCheckupId, sourceNamespace }),
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
            throw new HealthCheckupInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new HealthCheckupInputError({ message: "invalid preservation request" })
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
            throw new HealthCheckupInputError({ message: submitted.message })
          case "forbidden":
            throw new HealthCheckupForbiddenError()
          case "not_found":
            throw new HealthCheckupNotFoundError()
          case "conflict":
            throw new HealthCheckupConflictError()
          case "unavailable":
            throw new HealthCheckupUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
