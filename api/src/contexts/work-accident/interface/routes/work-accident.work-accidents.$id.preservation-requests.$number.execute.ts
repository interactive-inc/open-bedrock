import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  WorkAccidentForbiddenError,
  WorkAccidentInputError,
  WorkAccidentNotFoundError,
  WorkAccidentConflictError,
  WorkAccidentUnavailableError,
} from "@/contexts/work-accident/interface/errors"
import { RevalidateRecordPreservationExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-record-preservation-execution.adapter"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { workAccidentFactory } from "@/contexts/work-accident/interface/request-environment/work-accident-factory"
import { workAccidentIdSchema } from "@/contexts/work-accident/interface/http/work-accident-input-schemas"
import { RevalidateWorkAccidentRecordSourceAdapter } from "@/contexts/work-accident/infrastructure/adapters/revalidate-work-accident-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = workAccidentFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({ id: workAccidentIdSchema, number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new WorkAccidentForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "work-accident",
        recordKind: "work-accident-record",
        recordId: String(c.req.valid("param").id),
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateWorkAccidentRecordSourceAdapter({
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
          throw new WorkAccidentInputError({ message: result.message })
        case "forbidden":
          throw new WorkAccidentForbiddenError()
        case "not_found":
          throw new WorkAccidentNotFoundError()
        case "conflict":
          throw new WorkAccidentConflictError()
        case "unavailable":
          throw new WorkAccidentUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
