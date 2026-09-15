import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  ItIncidentForbiddenError,
  ItIncidentInputError,
  ItIncidentNotFoundError,
  ItIncidentConflictError,
  ItIncidentUnavailableError,
} from "@/contexts/it-incident/interface/errors"
import { RevalidateRecordPreservationExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-record-preservation-execution.adapter"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { itIncidentFactory } from "@/contexts/it-incident/interface/request-environment/it-incident-factory"
import { itIncidentIdSchema } from "@/contexts/it-incident/interface/http/it-incident-input-schemas"
import { RevalidateItIncidentRecordSourceAdapter } from "@/contexts/it-incident/infrastructure/adapters/revalidate-it-incident-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = itIncidentFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: itIncidentIdSchema, number: itIncidentIdSchema })),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new ItIncidentForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "it-incident",
        recordKind: "it-incident-record",
        recordId: String(c.req.valid("param").id),
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateItIncidentRecordSourceAdapter({
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
          throw new ItIncidentInputError({ message: result.message })
        case "forbidden":
          throw new ItIncidentForbiddenError()
        case "not_found":
          throw new ItIncidentNotFoundError()
        case "conflict":
          throw new ItIncidentConflictError()
        case "unavailable":
          throw new ItIncidentUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
