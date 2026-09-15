import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  CommendationForbiddenError,
  CommendationInputError,
  CommendationNotFoundError,
  CommendationConflictError,
  CommendationUnavailableError,
} from "@/contexts/commendation/interface/errors"
import { RevalidateRecordPreservationExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-record-preservation-execution.adapter"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { commendationFactory } from "@/contexts/commendation/interface/request-environment/commendation-factory"
import { commendationIdSchema } from "@/contexts/commendation/interface/http/commendation-input-schemas"
import { RevalidateCommendationRecordSourceAdapter } from "@/contexts/commendation/infrastructure/adapters/revalidate-commendation-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = commendationFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: commendationIdSchema, number: commendationIdSchema })),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new CommendationForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "commendation",
        recordKind: "commendation-record",
        recordId: String(c.req.valid("param").id),
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateCommendationRecordSourceAdapter({
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
          throw new CommendationInputError({ message: result.message })
        case "forbidden":
          throw new CommendationForbiddenError()
        case "not_found":
          throw new CommendationNotFoundError()
        case "conflict":
          throw new CommendationConflictError()
        case "unavailable":
          throw new CommendationUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
