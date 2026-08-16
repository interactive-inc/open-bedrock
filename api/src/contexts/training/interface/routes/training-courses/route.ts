import { factory } from "@/contexts/company/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { trainingCourses } from "@/contexts/training/infrastructure/schema/training"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppTrainingCourseList } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      category: z.string().optional(),
      status: z.enum(["active", "archived"]).optional(),
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

    const conditions: Array<SQL> = []

    if (query.category !== undefined) {
      conditions.push(eq(trainingCourses.category, query.category))
    }

    if (query.status !== undefined) {
      conditions.push(eq(trainingCourses.status, query.status))
    }

    const rows = await c.var.database
      .select()
      .from(trainingCourses)
      .where(conditions.length === 0 ? undefined : and(...conditions))
      .orderBy(asc(trainingCourses.id))
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(trainingCourses)
      .where(conditions.length === 0 ? undefined : and(...conditions))

    const responseBody = zAppTrainingCourseList.parse({
      data: rows.map((row) => ({
        id: row.id,
        code: row.code,
        title: row.title,
        description: row.description,
        duration_minutes: row.durationMinutes,
        category: row.category,
        is_required: row.isRequired,
        status: row.status,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
