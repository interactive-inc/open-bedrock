import { CreateCareerPosting } from "@/application/career/create-career-posting"
import type { CareerPosting } from "@/domain/career/career-posting.entity"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppCareerPosting, zAppCareerPostingList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { factory } from "@/interface/utils/factory"
import { careerPostings } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { count, desc, eq } from "drizzle-orm"
import { z } from "zod"

/** 公募をレスポンス用の snake_case に整形する。 */
function toResponseBody(posting: CareerPosting) {
  return zAppCareerPosting.parse({
    id: posting.id,
    title: posting.title,
    dept_id: posting.deptId,
    dept_name: posting.deptName,
    required_skills: posting.requiredSkills,
    status: posting.status,
  })
}

/** GET /career/postings — 公開中の公募一覧 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

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

  const rows = await c.var.database
    .select()
    .from(careerPostings)
    .where(eq(careerPostings.status, "open"))
    .orderBy(desc(careerPostings.id))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(careerPostings)
    .where(eq(careerPostings.status, "open"))

  const responseBody = zAppCareerPostingList.parse({
    data: rows.map((row) => ({
      id: row.id,
      title: row.title,
      dept_id: row.deptId,
      dept_name: row.deptName,
      required_skills: row.requiredSkills,
      status: row.status,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

/** POST /career/postings — 公募を新規作成（管理ロールのみ） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      dept_id: z.number().int().positive().nullable().optional(),
      dept_name: z.string().max(200).nullable().optional(),
      required_skills: z.string().max(3_000).nullable().optional(),
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
      session: session,
      title: body.title,
      deptId: body.dept_id ?? null,
      deptName: body.dept_name ?? null,
      requiredSkills: body.required_skills ?? null,
      status: body.status ?? "open",
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    return c.json(toResponseBody(created), 201)
  },
)
