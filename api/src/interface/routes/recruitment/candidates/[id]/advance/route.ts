import { AdvanceCandidate } from "@/application/recruitment/advance-candidate"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppRecruitmentCandidate } from "@/lib/app-schemas"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** POST /recruitment/candidates/:id/advance — 選考ステージを1つ前進または不採用へ（recruitment:manage）。不正遷移は 409。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      stage: z.enum(["applied", "screening", "interview", "offer", "hired", "rejected"]),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new AdvanceCandidate(c).run({
      session,
      id: validateIntParam(c.req.param("id"), "recruitment candidate"),
      stage: json.stage,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppRecruitmentCandidate.parse({
      id: updated.id,
      position_id: updated.positionId,
      name: updated.name,
      email: updated.email,
      source: updated.source,
      stage: updated.stage,
      note: updated.note,
      created_at: updated.createdAt,
    })

    return c.json(responseBody, 200)
  },
)
