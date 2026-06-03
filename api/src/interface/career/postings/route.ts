import { CreateCareerPosting } from "@/application/career/create-career-posting"
import type { CareerPosting } from "@/domain/career/career-posting"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { careerPostings } from "@/schema"
import { eq } from "drizzle-orm"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 公募をレスポンス用の snake_case に整形する。
function toResponseBody(posting: CareerPosting) {
  return {
    id: posting.id,
    title: posting.title,
    dept_id: posting.deptId,
    dept_name: posting.deptName,
    required_skills: posting.requiredSkills,
    status: posting.status,
  }
}

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

// POST /career/postings — 公募を新規作成（管理ロールのみ）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1),
      dept_id: z.number().int().nullable().optional(),
      dept_name: z.string().nullable().optional(),
      required_skills: z.string().nullable().optional(),
      status: z.enum(["open", "closed"]).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const body = c.req.valid("json")

    const created = await new CreateCareerPosting(c).run({
      viewerRole: session.role,
      title: body.title,
      deptId: body.dept_id ?? null,
      deptName: body.dept_name ?? null,
      requiredSkills: body.required_skills ?? null,
      status: body.status ?? "open",
    })

    if (created instanceof Error) {
      throw new InternalError("failed to create posting")
    }

    if ("reason" in created) {
      throw new ForbiddenError()
    }

    return c.json(toResponseBody(created), 201)
  },
)
