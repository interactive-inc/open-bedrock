import { UpdatePosition } from "@/contexts/recruitment/application/update-position"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppRecruitmentPosition } from "@/lib/app-schemas"
import { RecruitmentRepository } from "@/contexts/recruitment/infrastructure/recruitment.repository"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** GET /job-openings/:jobOpeningId — 募集ポジションの詳細（recruitment:manage）。 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("recruitment:manage") === false) {
    throw new ForbiddenError()
  }

  const id = validateIntParam(c.req.param("jobOpeningId"), "job opening")

  const repository = new RecruitmentRepository(c)

  const position = await repository.findPositionById(id)

  if (position instanceof Error) {
    throw new InternalError("failed to load recruitment position")
  }

  if (position === null) {
    throw new NotFoundError("recruitment position not found")
  }

  const responseBody = zAppRecruitmentPosition.parse({
    id: position.id,
    title: position.title,
    department_code: position.departmentCode,
    status: position.status,
    note: position.note,
    created_at: position.createdAt,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /job-openings/:jobOpeningId — 募集ポジションの内容・状態を更新（recruitment:manage）。 */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(200),
      department_code: z.string().max(100).nullable().optional(),
      status: z.enum(["open", "closed"]),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdatePosition(c).run({
      session,
      id: validateIntParam(c.req.param("jobOpeningId"), "job opening"),
      title: json.title,
      departmentCode: json.department_code ?? null,
      status: json.status,
      note: json.note ?? null,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppRecruitmentPosition.parse({
      id: updated.id,
      title: updated.title,
      department_code: updated.departmentCode,
      status: updated.status,
      note: updated.note,
      created_at: updated.createdAt,
    })

    return c.json(responseBody, 200)
  },
)
