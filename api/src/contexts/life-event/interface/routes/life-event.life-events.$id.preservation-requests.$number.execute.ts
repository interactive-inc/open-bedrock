import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  LifeEventForbiddenError,
  LifeEventInputError,
  LifeEventNotFoundError,
  LifeEventConflictError,
  LifeEventUnavailableError,
} from "@/contexts/life-event/interface/errors"
import { RevalidateRecordPreservationExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-record-preservation-execution.adapter"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { lifeEventFactory } from "@/contexts/life-event/interface/request-environment/life-event-factory"
import { lifeEventIdSchema } from "@/contexts/life-event/interface/http/life-event-input-schemas"
import { RevalidateLifeEventRecordSourceAdapter } from "@/contexts/life-event/infrastructure/adapters/revalidate-life-event-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = lifeEventFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: lifeEventIdSchema, number: z.coerce.number().int().positive().safe() })),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new LifeEventForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "life-event",
        recordKind: "life-event-record",
        recordId: String(c.req.valid("param").id),
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateLifeEventRecordSourceAdapter({
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
          throw new LifeEventInputError({ message: result.message })
        case "forbidden":
          throw new LifeEventForbiddenError()
        case "not_found":
          throw new LifeEventNotFoundError()
        case "conflict":
          throw new LifeEventConflictError()
        case "unavailable":
          throw new LifeEventUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
