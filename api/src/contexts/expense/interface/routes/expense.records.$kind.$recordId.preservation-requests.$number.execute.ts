import { UnexpectedError } from "@/lib/errors"
import { PrepareExpensePreservationReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-preservation-read.adapter"
import { expenseRecordKindSchema } from "@/contexts/expense/domain/schemas/expense-record-kind.schema"
import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import { SystemForbiddenError, SystemHTTPException } from "@system/interface/errors"
import { RevalidateRecordPreservationExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-record-preservation-execution.adapter"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { expenseFactory } from "@/contexts/expense/interface/request-environment/expense-factory"
import { RevalidateExpenseRecordSourceAdapter } from "@/contexts/expense/infrastructure/adapters/revalidate-expense-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原台帳、Company承認資格を再検査して一回だけ確定する
export const POST = expenseFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({
      kind: expenseRecordKindSchema,
      recordId: z.string().min(1).max(512),
      number: z.coerce.number().int().positive().safe(),
    }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new SystemForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const access = await new PrepareExpensePreservationReadAdapter(c).prepare({
      authentication,
      at: c.var.now(),
      permission:
        c.req.valid("param").kind === "expense-budget" ? "budget:manage" : "expense:read:all",
    })
    if (access instanceof UnexpectedError)
      throw new SystemHTTPException({
        status: 503,
        code: "record_preservation_unavailable",
        detail: "保全対象の参照資格を確認できません",
      })
    if (access instanceof Error) throw new SystemForbiddenError()
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "expense",
        recordKind: c.req.valid("param").kind,
        recordId: c.req.valid("param").recordId,
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateExpenseRecordSourceAdapter({
            env: c.env,
            var: c.var,
            now: c.var.now,
            sourceNamespace,
          }).prepare(source, { authentication, session: access.session }),
      },
      prepareExecution: (input) =>
        new RevalidateRecordPreservationExecutionAdapter(c).prepare(input),
    }).execute({
      authentication,
      number: c.req.valid("param").number,
      proposalDigest: c.req.valid("json").proposal_digest,
    })
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
