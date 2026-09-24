import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { executeSystemRecordPreservation } from "@system/interface/operations/execute-system-record-preservation"
import { RecordPreservationExecutionError } from "@system/application/records/errors"
import {
  RoomForbiddenError,
  RoomInputError,
  RoomNotFoundError,
  RoomConflictError,
  RoomUnavailableError,
} from "@/contexts/room/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { roomFactory } from "@/contexts/room/interface/request-environment/room-factory"
import { roomRecordRouteSchema } from "@/contexts/room/interface/http/room-input-schemas"
import { RevalidateRoomRecordSourceAdapter } from "@/contexts/room/infrastructure/adapters/revalidate-room-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = roomFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    roomRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new RoomForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await executeSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "room",
          recordKind: c.req.valid("param").recordKind,
          recordId: c.req.valid("param").recordId,
          sourceNamespace,
          revalidate: (source) =>
            new RevalidateRoomRecordSourceAdapter({
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
          throw new RoomInputError({ message: result.message })
        case "forbidden":
          throw new RoomForbiddenError()
        case "not_found":
          throw new RoomNotFoundError()
        case "conflict":
          throw new RoomConflictError()
        case "unavailable":
          throw new RoomUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
