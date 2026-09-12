import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { LeaveProcedureInboxAdapter } from "@/contexts/leave/infrastructure/adapters/leave-procedure-inbox.adapter"
import { zLeaveProcedureView } from "@/contexts/leave/interface/http/response-schemas"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"

// @authorization service - 現在の判断・確定資格を持つ案件だけを返す
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", z.object({ limit: z.string().optional(), offset: z.string().optional() })),
  async (c) => {
    if (c.var.session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
    const page = await new LeaveProcedureInboxAdapter(c).list({
      session: c.var.session,
      tokenVersion: c.var.accountTokenVersion,
      at: new Date(c.env.NOW ?? Date.now()),
      limit: toBoundedInt({
        raw: c.req.query("limit"),
        fallback: DEFAULT_LIST_LIMIT,
        min: 1,
        max: MAX_LIST_LIMIT,
      }),
      offset: toBoundedInt({
        raw: c.req.query("offset"),
        fallback: 0,
        min: 0,
        max: MAX_LIST_OFFSET,
      }),
    })
    if (page instanceof ApplicationError) throw toHttpException(page)
    return c.json(
      {
        data: page.data.map((view) => zLeaveProcedureView.parse(view)),
        next_offset: page.next_offset,
      },
      200,
    )
  },
)
