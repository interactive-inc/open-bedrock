import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  CompanyCalendarDayForbiddenError,
  CompanyCalendarDayInputError,
  CompanyCalendarDayNotFoundError,
  CompanyCalendarDayConflictError,
  CompanyCalendarDayUnavailableError,
} from "@/contexts/company-calendar/interface/errors"
import { RevalidateRecordPreservationExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-record-preservation-execution.adapter"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { companyCalendarDayFactory } from "@/contexts/company-calendar/interface/request-environment/company-calendar-factory"
import { companyCalendarDayIdSchema } from "@/contexts/company-calendar/interface/http/company-calendar-input-schemas"
import { RevalidateCompanyCalendarDayRecordSourceAdapter } from "@/contexts/company-calendar/infrastructure/adapters/revalidate-company-calendar-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = companyCalendarDayFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({
      id: companyCalendarDayIdSchema,
      number: z.coerce.number().int().positive().safe(),
    }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new CompanyCalendarDayForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "company-calendar",
        recordKind: "company-calendar-record",
        recordId: String(c.req.valid("param").id),
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateCompanyCalendarDayRecordSourceAdapter({
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
          throw new CompanyCalendarDayInputError({ message: result.message })
        case "forbidden":
          throw new CompanyCalendarDayForbiddenError()
        case "not_found":
          throw new CompanyCalendarDayNotFoundError()
        case "conflict":
          throw new CompanyCalendarDayConflictError()
        case "unavailable":
          throw new CompanyCalendarDayUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
