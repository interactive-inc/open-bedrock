import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  EmployeeWorkStyleForbiddenError,
  EmployeeWorkStyleInputError,
  EmployeeWorkStyleNotFoundError,
  EmployeeWorkStyleConflictError,
  EmployeeWorkStyleUnavailableError,
} from "@/contexts/work-style/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { employeeWorkStyleFactory } from "@/contexts/work-style/interface/request-environment/work-style-factory"
import { employeeWorkStyleIdSchema } from "@/contexts/work-style/interface/http/work-style-input-schemas"
import { RevalidateEmployeeWorkStyleRecordSourceAdapter } from "@/contexts/work-style/infrastructure/adapters/revalidate-employee-work-style-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = employeeWorkStyleFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({
      id: employeeWorkStyleIdSchema,
      number: z.coerce.number().int().positive().safe(),
    }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new EmployeeWorkStyleForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "work-style",
        recordKind: "employee-work-style-record",
        recordId: String(c.req.valid("param").id),
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateEmployeeWorkStyleRecordSourceAdapter({
            env: c.env,
            var: c.var,
            sourceNamespace,
          }).prepare(source),
      },
      prepareExecution: (input) =>
        revalidateCompanyRecordPreservationExecution(c, input),
    }).execute({
      authentication,
      number: c.req.valid("param").number,
      proposalDigest: c.req.valid("json").proposal_digest,
    })
    if (result instanceof RecordPreservationExecutionError) {
      switch (result.code) {
        case "invalid":
          throw new EmployeeWorkStyleInputError({ message: result.message })
        case "forbidden":
          throw new EmployeeWorkStyleForbiddenError()
        case "not_found":
          throw new EmployeeWorkStyleNotFoundError()
        case "conflict":
          throw new EmployeeWorkStyleConflictError()
        case "unavailable":
          throw new EmployeeWorkStyleUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
