import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { zExpenseProcedureView } from "@/contexts/expense/interface/http/response-schemas"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { ExpenseProcedureInboxAdapter } from "@/contexts/expense/infrastructure/adapters/expense-procedure-inbox.adapter"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"

// @authorization service - 現在の判断・実行資格を持つ案件だけを返す
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", z.object({ limit: z.string().optional(), offset: z.string().optional() })),
  async (c) => {
    const session = c.var.session
    if (session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
    const at = new Date(c.env.NOW ?? Date.now())
    const limit = toBoundedInt({
      raw: c.req.query("limit"),
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })
    const offset = toBoundedInt({
      raw: c.req.query("offset"),
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })
    const result = await new ExpenseProcedureInboxAdapter(c).list({
      session,
      tokenVersion: c.var.accountTokenVersion,
      at,
      limit,
      offset,
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    return c.json(
      {
        data: result.data.map((view) => zExpenseProcedureView.parse(view)),
        next_offset: result.next_offset,
      },
      200,
    )
  },
)
