import { zRingiProcedureView } from "@/contexts/ringi/interface/http/response-schemas"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { RingiProcedureListAdapter } from "@/contexts/ringi/infrastructure/adapters/ringi-procedure-list.adapter"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"

// @authorization service - 本人の申請だけを参照する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z
        .enum(["pending", "approved", "rejected", "returned", "cancelled", "awaiting_execution"])
        .optional(),
      applicant_id: zEmployeeId.optional(),
      sort: z.enum(["created_at_desc", "created_at_asc", "amount_desc", "amount_asc"]).optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
    const query = c.req.valid("query")
    const result = await new RingiProcedureListAdapter(c).list({
      session,
      tokenVersion: c.var.accountTokenVersion,
      at: new Date(c.env.NOW ?? Date.now()),
      mode: "mine",
      status: query.status ?? null,
      applicantId: query.applicant_id ?? null,
      sort: query.sort ?? "created_at_desc",
      limit: toBoundedInt({
        raw: query.limit,
        fallback: DEFAULT_LIST_LIMIT,
        min: 1,
        max: MAX_LIST_LIMIT,
      }),
      offset: toBoundedInt({ raw: query.offset, fallback: 0, min: 0, max: MAX_LIST_OFFSET }),
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    return c.json(
      { data: result.data.map((view) => zRingiProcedureView.parse(view)), total: result.total },
      200,
    )
  },
)
