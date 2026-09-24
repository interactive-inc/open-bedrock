import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { executeSystemRecordPreservation } from "@system/interface/operations/execute-system-record-preservation"
import { RecordPreservationExecutionError } from "@system/application/records/errors"
import {
  AntisocialCheckForbiddenError,
  AntisocialCheckInputError,
  AntisocialCheckNotFoundError,
  AntisocialCheckConflictError,
  AntisocialCheckUnavailableError,
} from "@/contexts/antisocial-check/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { antisocialCheckFactory } from "@/contexts/antisocial-check/interface/request-environment/antisocial-check-factory"
import { antisocialCheckIdSchema } from "@/contexts/antisocial-check/interface/http/antisocial-check-input-schemas"
import { RevalidateAntisocialCheckRecordSourceAdapter } from "@/contexts/antisocial-check/infrastructure/adapters/revalidate-antisocial-check-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = antisocialCheckFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({
      id: antisocialCheckIdSchema,
      number: z.coerce.number().int().positive().safe(),
    }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new AntisocialCheckForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await executeSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "antisocial-check",
          recordKind: "antisocial-check-record",
          recordId: String(c.req.valid("param").id),
          sourceNamespace,
          revalidate: (source) =>
            new RevalidateAntisocialCheckRecordSourceAdapter({
              env: c.env,
              var: c.var,
              sourceNamespace,
            }).prepare(source),
        },
        prepareExecution: (input) => revalidateCompanyRecordPreservationExecution(c, input),
      },
      {
        authentication,
        number: c.req.valid("param").number,
        proposalDigest: c.req.valid("json").proposal_digest,
      },
    )
    if (result instanceof RecordPreservationExecutionError) {
      switch (result.code) {
        case "invalid":
          throw new AntisocialCheckInputError({ message: result.message })
        case "forbidden":
          throw new AntisocialCheckForbiddenError()
        case "not_found":
          throw new AntisocialCheckNotFoundError()
        case "conflict":
          throw new AntisocialCheckConflictError()
        case "unavailable":
          throw new AntisocialCheckUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
