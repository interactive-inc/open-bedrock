import { RegisterPosition } from "@/contexts/company/application/recruitment/register-position"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppRecruitmentPosition, zAppRecruitmentPositionList } from "@/lib/app-schemas"
import { RecruitmentRepository } from "@/contexts/company/infrastructure/recruitment/recruitment-repository"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { InternalError } from "@/contexts/company/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** GET /job-openings — 募集ポジション一覧。閲覧も recruitment:manage に閉じる（社外個人情報の親のため）。 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["open", "closed"]).optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("recruitment:manage") === false) {
      throw new ForbiddenError()
    }

    const query = c.req.valid("query")

    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })

    const offset = toBoundedInt({ raw: query.offset, fallback: 0, min: 0, max: MAX_LIST_OFFSET })

    const repository = new RecruitmentRepository(c)

    const positions = await repository.listPositions({
      status: query.status ?? null,
      limit,
      offset,
    })

    if (positions instanceof Error) {
      throw new InternalError("failed to load recruitment positions")
    }

    const total = await repository.countPositions(query.status ?? null)

    if (total instanceof Error) {
      throw new InternalError("failed to count recruitment positions")
    }

    const responseBody = zAppRecruitmentPositionList.parse({
      data: positions.map((position) => ({
        id: position.id,
        title: position.title,
        department_code: position.departmentCode,
        status: position.status,
        note: position.note,
        created_at: position.createdAt,
      })),
      total,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** POST /job-openings — 募集ポジションを登録（recruitment:manage）。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(200),
      department_code: z.string().max(100).nullable().optional(),
      status: z.enum(["open", "closed"]).optional(),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new RegisterPosition(c).run({
      session,
      title: json.title,
      departmentCode: json.department_code ?? null,
      status: json.status ?? "open",
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppRecruitmentPosition.parse({
      id: created.id,
      title: created.title,
      department_code: created.departmentCode,
      status: created.status,
      note: created.note,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
