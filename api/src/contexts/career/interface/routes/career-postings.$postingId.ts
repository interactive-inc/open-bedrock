import { NotFoundError, UnexpectedError } from "@/lib/errors"
import { CareerPostingRepository } from "@/contexts/career/infrastructure/career-posting.repository"
import { DeleteCareerPosting } from "@/contexts/career/application/delete-career-posting"
import { UpdateCareerPosting } from "@/contexts/career/application/update-career-posting"
import type { CareerPosting } from "@/contexts/career/domain/career-posting.entity"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
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
/** GET /career-postings/:postingId — 応募に必要な公募の詳細（認証済みユーザー） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const postingId = validateIntParam(c.req.param("postingId"), "posting")

  const posting = await (async () => {
    const command = {
      postingId: postingId,
    }

    const postingRepository = new CareerPostingRepository(c)

    const posting = await postingRepository.findById(command.postingId)

    if (posting instanceof Error) {
      return new UnexpectedError("failed to find career posting", { cause: posting })
    }

    if (posting === null) {
      return new NotFoundError("career posting not found", "posting_not_found")
    }

    return posting
  })()

  if (posting instanceof ApplicationError) {
    throw toHttpException(posting)
  }

  return c.json(toResponseBody(posting), 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /career-postings/:postingId — 公募の内容と状態を変更（管理ロールのみ） */
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

    const postingId = validateIntParam(c.req.param("postingId"), "posting")

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
/** DELETE /career-postings/:postingId — 公募を削除（管理ロールのみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const postingId = validateIntParam(c.req.param("postingId"), "posting")

  const result = await new DeleteCareerPosting(c).run({
    session: session,
    postingId: postingId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
