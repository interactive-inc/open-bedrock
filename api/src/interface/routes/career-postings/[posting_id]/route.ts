import { DeleteCareerPosting } from "@/application/career/delete-career-posting"
import { GetCareerPosting } from "@/application/career/get-career-posting"
import { UpdateCareerPosting } from "@/application/career/update-career-posting"
import type { CareerPosting } from "@/domain/career/career-posting.entity"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppCareerPosting } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
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

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /career-postings/:posting_id — 応募に必要な公募の詳細（認証済みユーザー） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const postingId = validateIntParam(c.req.param("posting_id"), "posting")

  const posting = await new GetCareerPosting(c).run({
    postingId: postingId,
  })

  if (posting instanceof ApplicationError) {
    throw toHttpException(posting)
  }

  return c.json(toResponseBody(posting), 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /career-postings/:posting_id — 公募の内容と状態を変更（管理ロールのみ） */
export const PUT = factory.createHandlers(
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

    const postingId = validateIntParam(c.req.param("posting_id"), "posting")

    const body = c.req.valid("json")

    const updated = await new UpdateCareerPosting(c).run({
      session: session,
      postingId: postingId,
      title: body.title,
      deptId: body.dept_id ?? null,
      deptName: body.dept_name ?? null,
      requiredSkills: body.required_skills ?? null,
      status: body.status,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    return c.json(toResponseBody(updated), 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** DELETE /career-postings/:posting_id — 公募を削除（管理ロールのみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const postingId = validateIntParam(c.req.param("posting_id"), "posting")

  const result = await new DeleteCareerPosting(c).run({
    session: session,
    postingId: postingId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
