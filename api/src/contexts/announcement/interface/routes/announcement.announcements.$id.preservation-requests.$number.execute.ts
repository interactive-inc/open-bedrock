import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { executeSystemRecordPreservation } from "@system/interface/operations/execute-system-record-preservation"
import { RecordPreservationExecutionError } from "@system/application/records/errors"
import {
  AnnouncementForbiddenError,
  AnnouncementInputError,
  AnnouncementNotFoundError,
  AnnouncementConflictError,
  AnnouncementUnavailableError,
} from "@/contexts/announcement/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { announcementFactory } from "@/contexts/announcement/interface/request-environment/announcement-factory"
import { announcementIdSchema } from "@/contexts/announcement/interface/http/announcement-input-schemas"
import { RevalidateAnnouncementRecordSourceAdapter } from "@/contexts/announcement/infrastructure/adapters/revalidate-announcement-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = announcementFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({ id: announcementIdSchema, number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new AnnouncementForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await executeSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "announcement",
          recordKind: "announcement-record",
          recordId: String(c.req.valid("param").id),
          sourceNamespace,
          revalidate: (source) =>
            new RevalidateAnnouncementRecordSourceAdapter({
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
          throw new AnnouncementInputError({ message: result.message })
        case "forbidden":
          throw new AnnouncementForbiddenError()
        case "not_found":
          throw new AnnouncementNotFoundError()
        case "conflict":
          throw new AnnouncementConflictError()
        case "unavailable":
          throw new AnnouncementUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
