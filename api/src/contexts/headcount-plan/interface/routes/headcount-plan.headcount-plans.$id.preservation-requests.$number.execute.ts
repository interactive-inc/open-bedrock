import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { executeSystemRecordPreservation } from "@system/interface/operations/execute-system-record-preservation"
import { RecordPreservationExecutionError } from "@system/application/records/errors"
import {
  HeadcountPlanForbiddenError,
  HeadcountPlanInputError,
  HeadcountPlanNotFoundError,
  HeadcountPlanConflictError,
  HeadcountPlanUnavailableError,
} from "@/contexts/headcount-plan/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { headcountPlanFactory } from "@/contexts/headcount-plan/interface/request-environment/headcount-plan-factory"
import { headcountPlanIdSchema } from "@/contexts/headcount-plan/interface/http/headcount-plan-input-schemas"
import { RevalidateHeadcountPlanRecordSourceAdapter } from "@/contexts/headcount-plan/infrastructure/adapters/revalidate-headcount-plan-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = headcountPlanFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({
      id: headcountPlanIdSchema,
      number: z.coerce.number().int().positive().safe(),
    }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new HeadcountPlanForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await executeSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "headcount-plan",
          recordKind: "headcount-plan-record",
          recordId: String(c.req.valid("param").id),
          sourceNamespace,
          revalidate: (source) =>
            new RevalidateHeadcountPlanRecordSourceAdapter({
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
          throw new HeadcountPlanInputError({ message: result.message })
        case "forbidden":
          throw new HeadcountPlanForbiddenError()
        case "not_found":
          throw new HeadcountPlanNotFoundError()
        case "conflict":
          throw new HeadcountPlanConflictError()
        case "unavailable":
          throw new HeadcountPlanUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
