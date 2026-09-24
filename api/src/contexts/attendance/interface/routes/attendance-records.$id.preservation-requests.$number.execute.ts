import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { executeSystemRecordPreservation } from "@system/interface/operations/execute-system-record-preservation"
import { RecordPreservationExecutionError } from "@system/application/records/errors"
import { SystemForbiddenError, SystemHTTPException } from "@system/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { attendanceFactory } from "@/contexts/attendance/interface/request-environment/attendance-factory"
import { RevalidateAttendanceRecordSourceAdapter } from "@/contexts/attendance/infrastructure/adapters/revalidate-attendance-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原台帳、Company承認資格を再検査して一回だけ確定する
export const POST = attendanceFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({
      id: z.coerce.number().int().positive().safe(),
      number: z.coerce.number().int().positive().safe(),
    }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new SystemForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await executeSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "attendance",
          recordKind: "attendance-record",
          recordId: String(c.req.valid("param").id),
          sourceNamespace,
          revalidate: (source) =>
            new RevalidateAttendanceRecordSourceAdapter({
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
      const statuses: Readonly<
        Record<RecordPreservationExecutionError["code"], 400 | 403 | 404 | 409 | 503>
      > = { invalid: 400, forbidden: 403, not_found: 404, conflict: 409, unavailable: 503 }
      throw new SystemHTTPException({
        status: statuses[result.code],
        code: `record_preservation_${result.code}`,
        detail: result.message,
      })
    }
    return c.json(result, 200)
  },
)
