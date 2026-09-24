import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { executeSystemRecordPreservation } from "@system/interface/operations/execute-system-record-preservation"
import { RecordPreservationExecutionError } from "@system/application/records/errors"
import {
  CompensationChangeForbiddenError,
  CompensationChangeInputError,
  CompensationChangeNotFoundError,
  CompensationChangeConflictError,
  CompensationChangeUnavailableError,
} from "@/contexts/compensation-change/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { compensationChangeFactory } from "@/contexts/compensation-change/interface/request-environment/compensation-change-factory"
import { compensationChangeRecordRouteSchema } from "@/contexts/compensation-change/interface/http/compensation-change-input-schemas"
import { RevalidateCompensationChangeRecordSourceAdapter } from "@/contexts/compensation-change/infrastructure/adapters/revalidate-compensation-change-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = compensationChangeFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    compensationChangeRecordRouteSchema.extend({
      number: z.coerce.number().int().positive().safe(),
    }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new CompensationChangeForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await executeSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "compensation-change",
          recordKind: c.req.valid("param").recordKind,
          recordId: c.req.valid("param").recordId,
          sourceNamespace,
          revalidate: (source) =>
            new RevalidateCompensationChangeRecordSourceAdapter({
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
          throw new CompensationChangeInputError({ message: result.message })
        case "forbidden":
          throw new CompensationChangeForbiddenError()
        case "not_found":
          throw new CompensationChangeNotFoundError()
        case "conflict":
          throw new CompensationChangeConflictError()
        case "unavailable":
          throw new CompensationChangeUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
