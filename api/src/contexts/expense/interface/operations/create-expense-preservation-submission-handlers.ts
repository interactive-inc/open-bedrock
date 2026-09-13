import { UnexpectedError } from "@/lib/errors"
import { expenseRecordKindSchema } from "@/contexts/expense/domain/schemas/expense-record-kind.schema"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { expenseFactory } from "@/contexts/expense/interface/request-environment/expense-factory"
import { PrepareExpensePreservationReadAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-preservation-read.adapter"
import { CaptureExpenseSourceAdapter } from "@/contexts/expense/infrastructure/adapters/capture-expense-source.adapter"
import { PrepareCompanyRecordProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-task.adapter"
import { SystemForbiddenError, SystemHTTPException } from "@system/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** 経費原記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createExpensePreservationSubmissionHandlers(mode: "create" | "resubmit") {
  const idSchema = z.coerce.number().int().positive().safe()
  const requestSchema = z.strictObject({
    procedure_key: procedureKeySchema,
    conditions: recordPreservationRequestSchema,
  })
  const schemas = {
    create: requestSchema,
    resubmit: requestSchema.extend({
      previous_version: z.number().int().positive().safe(),
      previous_digest: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  }
  return expenseFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        kind: expenseRecordKindSchema,
        recordId: z.string().min(1).max(512),
        number: idSchema.optional(),
      }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new SystemForbiddenError()
      const request = c.req.valid("json")
      const recordId = c.req.valid("param").recordId
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
      const reader = { authentication, session: access.session }
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "expense",
          recordKind: c.req.valid("param").kind,
          recordId,
          sourceNamespace,
          authorize: async () => {
            const assertions = access.assertions(c.var.now())
            return assertions instanceof Error ? assertions : { assertions }
          },
          capture: () =>
            new CaptureExpenseSourceAdapter({
              env: c.env,
              var: c.var,
              now: c.var.now,
            }).prepare(
              { recordKind: c.req.valid("param").kind, recordId, sourceNamespace },
              reader,
            ),
        },
        prepareTask: (input) => new PrepareCompanyRecordProcedureTaskAdapter(c).prepare(input),
      })
      const common = {
        authentication,
        procedureKey: request.procedure_key,
        conditions: request.conditions,
      }
      const submit = async () => {
        if (mode === "create") {
          const idempotencyKey = c.req.valid("header")["idempotency-key"]
          if (idempotencyKey === undefined) return new RecordPreservationSubmissionError("invalid")
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          return new RecordPreservationSubmissionError("invalid")
        return adapter.execute({
          ...common,
          revision: {
            mode: "resubmit",
            number,
            previousVersion: request.previous_version,
            previousDigest: request.previous_digest,
          },
        })
      }
      const submitted = await submit()
      if (submitted instanceof RecordPreservationSubmissionError) {
        const statuses: Readonly<
          Record<RecordPreservationSubmissionError["code"], 400 | 403 | 404 | 409 | 503>
        > = {
          invalid: 400,
          forbidden: 403,
          not_found: 404,
          conflict: 409,
          unavailable: 503,
        }
        throw new SystemHTTPException({
          status: statuses[submitted.code],
          code: `record_preservation_${submitted.code}`,
          detail: submitted.message,
        })
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
