import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { batchJobs } from "@/schema"
import { count, desc } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("batch:view") === false) {
      throw new ForbiddenError()
    }

    const parsed = c.req.valid("query")

    const limit = toBoundedInt({
      raw: parsed.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })

    const offset = toBoundedInt({
      raw: parsed.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })

    const rows = await c.var.database
      .select()
      .from(batchJobs)
      .orderBy(desc(batchJobs.id))
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database.select({ total: count() }).from(batchJobs)

    const responseBody = rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      started_at: row.startedAt,
      finished_at: row.finishedAt,
      message: row.message,
    }))

    return c.json({ data: responseBody, total: totalRows.at(0)?.total ?? 0 }, 200)
  },
)
