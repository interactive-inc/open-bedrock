import { CreateDecision } from "@/contexts/meeting/application/decision/create-decision"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppDecision, zAppDecisionList } from "@/contexts/meeting/interface/http/response-schemas"
import { decisions } from "@/contexts/meeting/infrastructure/schema/meeting"
import { count, desc } from "drizzle-orm"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /decision-records — 意思決定記録一覧（全認証者） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) {
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

  const [rows, totalRows] = await Promise.all([
    c.var.database
      .select()
      .from(decisions)
      .orderBy(desc(decisions.decidedOn), desc(decisions.id))
      .limit(limit)
      .offset(offset),
    c.var.database.select({ total: count() }).from(decisions),
  ])

  const responseBody = zAppDecisionList.parse({
    data: rows.map((row) => ({
      id: row.id,
      title: row.title,
      decided_on: row.decidedOn,
      context: row.context,
      decision: row.decision,
      consequences: row.consequences,
      status: row.status,
      superseded_by_id: row.supersededById,
      created_at: row.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /decision-records — 意思決定記録を新規作成（decision:manage） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      decided_on: z.string().min(1).max(64),
      context: z.string().min(1).max(20_000),
      decision: z.string().min(1).max(20_000),
      consequences: z.string().max(20_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new CreateDecision(c).run({
      session: session,
      title: json.title,
      decidedOn: json.decided_on,
      context: json.context,
      decision: json.decision,
      consequences: json.consequences ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppDecision.parse({
      id: created.id,
      title: created.title,
      decided_on: created.decidedOn,
      context: created.context,
      decision: created.decision,
      consequences: created.consequences,
      status: created.status,
      superseded_by_id: created.supersededById,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
