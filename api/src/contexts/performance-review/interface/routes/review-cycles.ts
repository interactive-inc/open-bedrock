import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { CreateReviewCycle } from "@/contexts/performance-review/application/review/create-review-cycle"
import { zReviewCyclePolicy } from "@/contexts/performance-review/domain/review/review-cycle-policy"
import { toReviewCycleStatus } from "@/contexts/performance-review/domain/review/review-cycle-status.value"
import { reviewCycles } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import { zAppReviewCycle, zAppReviewCycleList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { asc, count, eq } from "drizzle-orm"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /review-cycles — 管理者が draft の評価サイクルを作成 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      period: z.string().min(1).max(100),
      dueDate: isoDate.optional(),
      policy: zReviewCyclePolicy.optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const cycle = await new CreateReviewCycle(c).run({
      session: session,
      title: json.title,
      period: json.period,
      dueDate: json.dueDate ?? null,
      policy: json.policy,
    })

    if (cycle instanceof ApplicationError) {
      throw toHttpException(cycle)
    }

    const responseBody = zAppReviewCycle.parse({
      id: cycle.id,
      title: cycle.title,
      period: cycle.period,
      status: cycle.status,
      due_date: cycle.dueDate,
    })

    return c.json(responseBody, 201)
  },
)

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const isAdmin = session.hasPermission("review:administer")

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

  const query = c.var.database.select().from(reviewCycles)

  const rows = isAdmin
    ? await query.orderBy(asc(reviewCycles.id)).limit(limit).offset(offset)
    : await query
        .where(eq(reviewCycles.status, "open"))
        .orderBy(asc(reviewCycles.id))
        .limit(limit)
        .offset(offset)

  const countQuery = c.var.database.select({ total: count() }).from(reviewCycles)

  const totalRows = isAdmin
    ? await countQuery
    : await countQuery.where(eq(reviewCycles.status, "open"))

  const responseBody = zAppReviewCycleList.parse({
    data: rows.map((row) => ({
      id: row.id,
      title: row.title,
      period: row.period,
      status: toReviewCycleStatus(row.status),
      due_date: row.dueDate,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
