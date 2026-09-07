import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError, ConflictError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { CompleteApprovedExpenseProcedure } from "@/contexts/expense/application/complete-approved-expense-procedure"
import { ExpenseProcedureReadAdapter } from "@/contexts/expense/infrastructure/adapters/expense-procedure-read.adapter"

// @authorization service - 確認した判断対象と現在の資格を保存時にも照合する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        decision_target: z
          .object({
            proposal_version: z.number().int().positive(),
            proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
            task_key: z.string().min(1).max(100),
            task_round: z.number().int().positive(),
          })
          .strict(),
      })
      .strict(),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
    const target = c.req.valid("json").decision_target
    const expenseId = validateIntParam(c.req.param("id"), "expense")
    const at = new Date(c.env.NOW ?? Date.now())
    const view = await new ExpenseProcedureReadAdapter(c).find({
      expenseId,
      session,
      tokenVersion: c.var.accountTokenVersion,
      at,
    })
    if (view instanceof ApplicationError) throw toHttpException(view)
    if (
      view.decision_target === null ||
      view.decision_target.proposal_version !== target.proposal_version ||
      view.decision_target.proposal_digest !== target.proposal_digest ||
      view.decision_target.task_key !== target.task_key ||
      view.decision_target.task_round !== target.task_round
    )
      throw toHttpException(
        new ConflictError("確認した判断対象が変わりました", "decision_target_changed"),
      )
    const saved = await new CompleteApprovedExpenseProcedure(c).run({
      expenseId,
      session,
      tokenVersion: c.var.accountTokenVersion,
      completedAt: at,
    })
    if (saved instanceof ApplicationError) throw toHttpException(saved)
    return c.json(saved, 200)
  },
)
