import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  RentalReservationForbiddenError,
  RentalReservationInputError,
  RentalReservationNotFoundError,
  RentalReservationConflictError,
  RentalReservationUnavailableError,
} from "@/contexts/rental/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { rentalReservationFactory } from "@/contexts/rental/interface/request-environment/rental-factory"
import { rentalReservationIdSchema } from "@/contexts/rental/interface/http/rental-input-schemas"
import { RevalidateRentalReservationRecordSourceAdapter } from "@/contexts/rental/infrastructure/adapters/revalidate-rental-reservation-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = rentalReservationFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({
      id: rentalReservationIdSchema,
      number: z.coerce.number().int().positive().safe(),
    }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new RentalReservationForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "rental",
        recordKind: "rental-reservation-record",
        recordId: String(c.req.valid("param").id),
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateRentalReservationRecordSourceAdapter({
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
          throw new RentalReservationInputError({ message: result.message })
        case "forbidden":
          throw new RentalReservationForbiddenError()
        case "not_found":
          throw new RentalReservationNotFoundError()
        case "conflict":
          throw new RentalReservationConflictError()
        case "unavailable":
          throw new RentalReservationUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
