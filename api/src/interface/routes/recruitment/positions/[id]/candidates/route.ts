import { RegisterCandidate } from "@/application/recruitment/register-candidate"
import { canManageRecruitment } from "@/lib/recruitment/can-manage-recruitment"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppRecruitmentCandidate, zAppRecruitmentCandidateList } from "@/lib/app-schemas"
import { RecruitmentRepository } from "@/infrastructure/recruitment/recruitment-repository"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** GET /recruitment/positions/:id/candidates — 募集配下の応募者一覧（recruitment:manage。社外個人情報のため非公開）。 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canManageRecruitment(session) === false) {
    throw new ForbiddenError()
  }

  const positionId = validateIntParam(c.req.param("id"), "recruitment position")

  const repository = new RecruitmentRepository(c)

  const position = await repository.findPositionById(positionId)

  if (position instanceof Error) {
    throw new InternalError("failed to load recruitment position")
  }

  if (position === null) {
    throw new NotFoundError("recruitment position not found")
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

  const candidates = await repository.listCandidatesByPosition({ positionId, limit, offset })

  if (candidates instanceof Error) {
    throw new InternalError("failed to load recruitment candidates")
  }

  const total = await repository.countCandidatesByPosition(positionId)

  if (total instanceof Error) {
    throw new InternalError("failed to count recruitment candidates")
  }

  const responseBody = zAppRecruitmentCandidateList.parse({
    data: candidates.map((candidate) => ({
      id: candidate.id,
      position_id: candidate.positionId,
      name: candidate.name,
      email: candidate.email,
      source: candidate.source,
      stage: candidate.stage,
      note: candidate.note,
      created_at: candidate.createdAt,
    })),
    total,
  })

  return c.json(responseBody, 200)
})

/** POST /recruitment/positions/:id/candidates — 応募者を applied で登録（recruitment:manage）。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(200),
      email: z.string().max(200).nullable().optional(),
      source: z.string().max(200).nullable().optional(),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new RegisterCandidate(c).run({
      session,
      positionId: validateIntParam(c.req.param("id"), "recruitment position"),
      name: json.name,
      email: json.email ?? null,
      source: json.source ?? null,
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppRecruitmentCandidate.parse({
      id: created.id,
      position_id: created.positionId,
      name: created.name,
      email: created.email,
      source: created.source,
      stage: created.stage,
      note: created.note,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
