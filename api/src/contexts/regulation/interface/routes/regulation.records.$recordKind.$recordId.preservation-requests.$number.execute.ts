import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { executeSystemRecordPreservation } from "@system/interface/operations/execute-system-record-preservation"
import { RecordPreservationExecutionError } from "@system/application/records/errors"
import {
  RegulationForbiddenError,
  RegulationInputError,
  RegulationNotFoundError,
  RegulationConflictError,
  RegulationUnavailableError,
} from "@/contexts/regulation/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { regulationFactory } from "@/contexts/regulation/interface/request-environment/regulation-factory"
import { regulationRecordRouteSchema } from "@/contexts/regulation/interface/http/regulation-input-schemas"
import { RevalidateRegulationRecordSourceAdapter } from "@/contexts/regulation/infrastructure/adapters/revalidate-regulation-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = regulationFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    regulationRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new RegulationForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await executeSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "regulation",
          recordKind: c.req.valid("param").recordKind,
          recordId: c.req.valid("param").recordId,
          sourceNamespace,
          revalidate: (source) =>
            new RevalidateRegulationRecordSourceAdapter({
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
          throw new RegulationInputError({ message: result.message })
        case "forbidden":
          throw new RegulationForbiddenError()
        case "not_found":
          throw new RegulationNotFoundError()
        case "conflict":
          throw new RegulationConflictError()
        case "unavailable":
          throw new RegulationUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
