import { UpdateDecision } from "@/application/decision/update-decision"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppDecision } from "@/lib/app-schemas"
import { decisions } from "@/schema"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** GET /decisions/:id — 意思決定記録の詳細（全認証者） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) {
    throw new UnauthorizedError()
  }

  const decisionId = validateIntParam(c.req.param("id"), "decision")

  const rows = await c.var.database
    .select()
    .from(decisions)
    .where(eq(decisions.id, decisionId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("decision not found")
  }

  const responseBody = zAppDecision.parse({
    id: row.id,
    title: row.title,
    decided_on: row.decidedOn,
    context: row.context,
    decision: row.decision,
    consequences: row.consequences,
    status: row.status,
    superseded_by_id: row.supersededById,
    created_at: row.createdAt,
  })

  return c.json(responseBody, 200)
})

/** PUT /decisions/:id — 意思決定記録を更新（decision:manage） */
export const PUT = factory.createHandlers(
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

    const decisionId = validateIntParam(c.req.param("id"), "decision")

    const json = c.req.valid("json")

    const updated = await new UpdateDecision(c).run({
      session: session,
      decisionId: decisionId,
      title: json.title,
      decidedOn: json.decided_on,
      context: json.context,
      decision: json.decision,
      consequences: json.consequences ?? null,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppDecision.parse({
      id: updated.id,
      title: updated.title,
      decided_on: updated.decidedOn,
      context: updated.context,
      decision: updated.decision,
      consequences: updated.consequences,
      status: updated.status,
      superseded_by_id: updated.supersededById,
      created_at: updated.createdAt,
    })

    return c.json(responseBody, 200)
  },
)
