import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  BusinessTripForbiddenError,
  BusinessTripInputError,
  BusinessTripNotFoundError,
  BusinessTripConflictError,
  BusinessTripUnavailableError,
} from "@/contexts/business-trip/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { businessTripFactory } from "@/contexts/business-trip/interface/request-environment/business-trip-factory"
import { businessTripIdSchema } from "@/contexts/business-trip/interface/http/business-trip-input-schemas"
import { RevalidateBusinessTripRecordSourceAdapter } from "@/contexts/business-trip/infrastructure/adapters/revalidate-business-trip-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = businessTripFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({ id: businessTripIdSchema, number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new BusinessTripForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "business-trip",
        recordKind: "business-trip-record",
        recordId: String(c.req.valid("param").id),
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateBusinessTripRecordSourceAdapter({
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
          throw new BusinessTripInputError({ message: result.message })
        case "forbidden":
          throw new BusinessTripForbiddenError()
        case "not_found":
          throw new BusinessTripNotFoundError()
        case "conflict":
          throw new BusinessTripConflictError()
        case "unavailable":
          throw new BusinessTripUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
