import { SupersedeDecision } from "@/contexts/meeting/application/decision/supersede-decision"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppDecision } from "@/contexts/meeting/interface/http/response-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /decision-records/:id/supersede — 対象の決定を後続の決定で supersede（decision:manage） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      superseded_by_id: z.number().int().positive(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const decisionId = validateIntParam(c.req.param("id"), "decision")

    const json = c.req.valid("json")

    const superseded = await new SupersedeDecision(c).run({
      session: session,
      decisionId: decisionId,
      supersededById: json.superseded_by_id,
    })

    if (superseded instanceof ApplicationError) {
      throw toHttpException(superseded)
    }

    const responseBody = zAppDecision.parse({
      id: superseded.id,
      title: superseded.title,
      decided_on: superseded.decidedOn,
      context: superseded.context,
      decision: superseded.decision,
      consequences: superseded.consequences,
      status: superseded.status,
      superseded_by_id: superseded.supersededById,
      created_at: superseded.createdAt,
    })

    return c.json(responseBody, 200)
  },
)
