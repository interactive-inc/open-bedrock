import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  RingiForbiddenError,
  RingiInputError,
  RingiNotFoundError,
  RingiConflictError,
  RingiUnavailableError,
} from "@/contexts/ringi/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { ringiFactory } from "@/contexts/ringi/interface/request-environment/ringi-factory"
import { ringiRecordRouteSchema } from "@/contexts/ringi/interface/http/ringi-input-schemas"
import { RevalidateRingiRecordSourceAdapter } from "@/contexts/ringi/infrastructure/adapters/revalidate-ringi-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = ringiFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    ringiRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new RingiForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "ringi",
        recordKind: c.req.valid("param").recordKind,
        recordId: c.req.valid("param").recordId,
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateRingiRecordSourceAdapter({
            env: c.env,
            var: c.var,
            sourceNamespace,
          }).prepare(source),
      },
      prepareExecution: (input) => revalidateCompanyRecordPreservationExecution(c, input),
    }).execute({
      authentication,
      number: c.req.valid("param").number,
      proposalDigest: c.req.valid("json").proposal_digest,
    })
    if (result instanceof RecordPreservationExecutionError) {
      switch (result.code) {
        case "invalid":
          throw new RingiInputError({ message: result.message })
        case "forbidden":
          throw new RingiForbiddenError()
        case "not_found":
          throw new RingiNotFoundError()
        case "conflict":
          throw new RingiConflictError()
        case "unavailable":
          throw new RingiUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
