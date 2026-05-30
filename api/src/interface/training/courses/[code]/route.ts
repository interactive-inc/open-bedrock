import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { NotFoundError } from "@/interface/lib/errors"
import { trainingCourses } from "@/schema"
import { eq } from "drizzle-orm"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const code = c.req.param("code") ?? ""

  const rows = await c.var.database
    .select()
    .from(trainingCourses)
    .where(eq(trainingCourses.code, code))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("course not found")
  }

  const responseBody = {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    duration_minutes: row.durationMinutes,
    category: row.category,
    is_required: row.isRequired,
    status: row.status,
  }

  return c.json(responseBody, 200)
})
