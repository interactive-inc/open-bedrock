import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { careerPostings } from "@/schema"
import { eq } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"

// GET /career/postings — 公開中の公募一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const rows = await c.var.database
    .select()
    .from(careerPostings)
    .where(eq(careerPostings.status, "open"))

  const responseBody = rows.map((row) => ({
    id: row.id,
    title: row.title,
    dept_id: row.deptId,
    dept_name: row.deptName,
    required_skills: row.requiredSkills,
    status: row.status,
  }))

  return c.json(responseBody, 200)
})
