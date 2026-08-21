import { CreateCommendation } from "@/contexts/commendation/application/create-commendation"
import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { InternalError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppCommendation, zAppCommendationList } from "@/lib/app-schemas"
import { CommendationRepository } from "@/contexts/commendation/infrastructure/commendation.repository"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /commendations?employee_id= — 表彰の記録一覧。閲覧は全認証者（社内公開）。 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const employeeIdRaw = c.req.query("employee_id")

  const employeeId =
    employeeIdRaw === undefined || employeeIdRaw === "" ? null : Number(employeeIdRaw)

  if (employeeId !== null && (Number.isInteger(employeeId) === false || employeeId <= 0)) {
    const responseBody = zAppCommendationList.parse({ data: [], total: 0 })

    return c.json(responseBody, 200)
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

  const repository = new CommendationRepository(c)

  const commendationList = await repository.list({ employeeId, limit, offset })

  if (commendationList instanceof Error) {
    throw new InternalError("failed to load commendations")
  }

  const total = await repository.count(employeeId)

  if (total instanceof Error) {
    throw new InternalError("failed to count commendations")
  }

  const responseBody = zAppCommendationList.parse({
    data: commendationList.map((commendation) => ({
      id: commendation.id,
      employee_id: commendation.employeeId,
      title: commendation.title,
      reason: commendation.reason,
      awarded_on: commendation.awardedOn,
      created_at: commendation.createdAt,
    })),
    total,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /commendations — 表彰を記録（commendation:manage）。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_id: z.number().int().positive(),
      title: z.string().min(1).max(200),
      reason: z.string().min(1).max(3_000),
      awarded_on: isoDate,
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new CreateCommendation(c).run({
      session,
      employeeId: json.employee_id,
      title: json.title,
      reason: json.reason,
      awardedOn: json.awarded_on,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppCommendation.parse({
      id: created.id,
      employee_id: created.employeeId,
      title: created.title,
      reason: created.reason,
      awarded_on: created.awardedOn,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
