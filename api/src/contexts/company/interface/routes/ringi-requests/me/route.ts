import { factory } from "@/contexts/company/interface/utils/factory"
import { zAppRingiMineList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { ringiStatusSchema } from "@/lib/schemas"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { employees, ringiRequests } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, count, desc, eq } from "drizzle-orm"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** GET /ringi-requests/me — 本人が起案した稟議一覧（status で絞り込み可能） */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: ringiStatusSchema.optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })

    const offset = toBoundedInt({
      raw: query.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })

    const conditions = [eq(ringiRequests.applicantId, session.employeeId)]

    if (query.status !== undefined) {
      conditions.push(eq(ringiRequests.status, query.status))
    }

    const [rows, totalRows] = await Promise.all([
      c.var.database
        .select({ ringi: ringiRequests, approverName: employees.name })
        .from(ringiRequests)
        .leftJoin(employees, eq(employees.id, ringiRequests.approverId))
        .where(and(...conditions))
        .orderBy(desc(ringiRequests.id))
        .limit(limit)
        .offset(offset),
      c.var.database
        .select({ total: count() })
        .from(ringiRequests)
        .where(and(...conditions)),
    ])

    const responseBody = zAppRingiMineList.parse({
      data: rows.map((row) => ({
        id: row.ringi.id,
        approver_id: row.ringi.approverId,
        approver_name: row.approverName ?? "",
        title: row.ringi.title,
        amount: row.ringi.amount,
        status: row.ringi.status,
        decided_at: row.ringi.decidedAt,
        created_at: row.ringi.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
