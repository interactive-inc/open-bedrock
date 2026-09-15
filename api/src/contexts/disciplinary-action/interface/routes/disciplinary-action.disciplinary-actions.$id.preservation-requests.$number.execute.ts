import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  DisciplinaryActionForbiddenError,
  DisciplinaryActionInputError,
  DisciplinaryActionNotFoundError,
  DisciplinaryActionConflictError,
  DisciplinaryActionUnavailableError,
} from "@/contexts/disciplinary-action/interface/errors"
import { RevalidateRecordPreservationExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-record-preservation-execution.adapter"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { disciplinaryActionFactory } from "@/contexts/disciplinary-action/interface/request-environment/disciplinary-action-factory"
import { disciplinaryActionIdSchema } from "@/contexts/disciplinary-action/interface/http/disciplinary-action-input-schemas"
import { RevalidateDisciplinaryActionRecordSourceAdapter } from "@/contexts/disciplinary-action/infrastructure/adapters/revalidate-disciplinary-action-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = disciplinaryActionFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: disciplinaryActionIdSchema, number: disciplinaryActionIdSchema })),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new DisciplinaryActionForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "disciplinary-action",
        recordKind: "disciplinary-action-record",
        recordId: String(c.req.valid("param").id),
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateDisciplinaryActionRecordSourceAdapter({
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
          throw new DisciplinaryActionInputError({ message: result.message })
        case "forbidden":
          throw new DisciplinaryActionForbiddenError()
        case "not_found":
          throw new DisciplinaryActionNotFoundError()
        case "conflict":
          throw new DisciplinaryActionConflictError()
        case "unavailable":
          throw new DisciplinaryActionUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
