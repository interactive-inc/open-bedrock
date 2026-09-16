import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  ShiftForbiddenError,
  ShiftInputError,
  ShiftNotFoundError,
  ShiftConflictError,
  ShiftUnavailableError,
} from "@/contexts/shift/interface/errors"
import { RevalidateRecordPreservationExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-record-preservation-execution.adapter"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { shiftFactory } from "@/contexts/shift/interface/request-environment/shift-factory"
import { shiftRecordRouteSchema } from "@/contexts/shift/interface/http/shift-input-schemas"
import { RevalidateShiftRecordSourceAdapter } from "@/contexts/shift/infrastructure/adapters/revalidate-shift-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = shiftFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    shiftRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new ShiftForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "shift",
        recordKind: c.req.valid("param").recordKind,
        recordId: c.req.valid("param").recordId,
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateShiftRecordSourceAdapter({
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
          throw new ShiftInputError({ message: result.message })
        case "forbidden":
          throw new ShiftForbiddenError()
        case "not_found":
          throw new ShiftNotFoundError()
        case "conflict":
          throw new ShiftConflictError()
        case "unavailable":
          throw new ShiftUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
