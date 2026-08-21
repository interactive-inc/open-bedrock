import { RegisterCandidate } from "@/contexts/recruitment/application/register-candidate"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { ForbiddenError, InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppRecruitmentCandidate, zAppRecruitmentCandidateList } from "@/lib/app-schemas"
import { RecruitmentRepository } from "@/contexts/recruitment/infrastructure/recruitment.repository"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** GET /job-openings/:jobOpeningId/candidates — 募集配下の応募者一覧（recruitment:manage。社外個人情報のため非公開）。 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("recruitment:manage") === false) {
    throw new ForbiddenError()
  }

  const positionId = validateIntParam(c.req.param("jobOpeningId"), "job opening")

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

// @authorization service - session を application service に渡して判定する
/** POST /job-openings/:jobOpeningId/candidates — 応募者を applied で登録（recruitment:manage）。 */
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
      positionId: validateIntParam(c.req.param("jobOpeningId"), "job opening"),
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
