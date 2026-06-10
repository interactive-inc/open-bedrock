import { DeleteCareerPosting } from "@/application/career/delete-career-posting"
import { GetCareerPosting } from "@/application/career/get-career-posting"
import { UpdateCareerPosting } from "@/application/career/update-career-posting"
import type { CareerPosting } from "@/domain/career/career-posting"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
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

// GET /career/postings/:posting_id — 公募の詳細（管理ロールのみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const postingId = validateIntParam(c.req.param("posting_id"), "posting")

  const posting = await new GetCareerPosting(c).run({
    viewerRole: session.role,
    postingId: postingId,
  })

  if (posting instanceof Error) {
    throw new InternalError("failed to load posting")
  }

  if ("reason" in posting) {
    if (posting.reason === "posting_not_found") {
      throw new NotFoundError("posting not found")
    }

    throw new ForbiddenError()
  }

  return c.json(toResponseBody(posting), 200)
})

// PUT /career/postings/:posting_id — 公募の内容と状態を変更（管理ロールのみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      dept_id: z.number().int().nullable().optional(),
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
      viewerRole: session.role,
      postingId: postingId,
      title: body.title,
      deptId: body.dept_id ?? null,
      deptName: body.dept_name ?? null,
      requiredSkills: body.required_skills ?? null,
      status: body.status ?? "open",
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to update posting")
    }

    if ("reason" in updated) {
      if (updated.reason === "posting_not_found") {
        throw new NotFoundError("posting not found")
      }

      throw new ForbiddenError()
    }

    return c.json(toResponseBody(updated), 200)
  },
)

// DELETE /career/postings/:posting_id — 公募を削除（管理ロールのみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const postingId = validateIntParam(c.req.param("posting_id"), "posting")

  const result = await new DeleteCareerPosting(c).run({
    viewerRole: session.role,
    postingId: postingId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete posting")
  }

  if (result.reason === "posting_not_found") {
    throw new NotFoundError("posting not found")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  if (result.reason === "has_applied_applications") {
    throw new ConflictError("cannot delete a posting with pending applications")
  }

  return c.body(null, 204)
})
