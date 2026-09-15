import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  HealthCheckupForbiddenError,
  HealthCheckupInputError,
  HealthCheckupNotFoundError,
  HealthCheckupConflictError,
  HealthCheckupUnavailableError,
} from "@/contexts/health-checkup/interface/errors"
import { RevalidateRecordPreservationExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-record-preservation-execution.adapter"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { healthCheckupFactory } from "@/contexts/health-checkup/interface/request-environment/health-checkup-factory"
import { healthCheckupIdSchema } from "@/contexts/health-checkup/interface/http/health-checkup-input-schemas"
import { RevalidateHealthCheckupRecordSourceAdapter } from "@/contexts/health-checkup/infrastructure/adapters/revalidate-health-checkup-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = healthCheckupFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: healthCheckupIdSchema, number: healthCheckupIdSchema })),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new HealthCheckupForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "health-checkup",
        recordKind: "health-checkup-record",
        recordId: String(c.req.valid("param").id),
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateHealthCheckupRecordSourceAdapter({
            env: c.env,
            var: c.var,
            sourceNamespace,
          }).prepare(source),
      },
      prepareExecution: (input) =>
        new RevalidateRecordPreservationExecutionAdapter(c).prepare(input),
    }).execute({
      authentication,
      number: c.req.valid("param").number,
      proposalDigest: c.req.valid("json").proposal_digest,
    })
    if (result instanceof RecordPreservationExecutionError) {
      switch (result.code) {
        case "invalid":
          throw new HealthCheckupInputError({ message: result.message })
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
    return c.json(result, 200)
  },
)
