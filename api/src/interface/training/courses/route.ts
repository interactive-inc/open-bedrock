import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { trainingCourses } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, asc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { z } from "zod"

export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", z.object({ category: z.string().optional(), status: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("query")

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

    const responseBody = rows.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      duration_minutes: row.durationMinutes,
      category: row.category,
      is_required: row.isRequired,
      status: row.status,
    }))

    return c.json(responseBody, 200)
  },
)
