import { HireCandidate } from "@/contexts/recruitment/application/hire-candidate"
import { MoveCandidateToInterview } from "@/contexts/recruitment/application/move-candidate-to-interview"
import { MoveCandidateToOffer } from "@/contexts/recruitment/application/move-candidate-to-offer"
import { MoveCandidateToScreening } from "@/contexts/recruitment/application/move-candidate-to-screening"
import { RejectCandidate } from "@/contexts/recruitment/application/reject-candidate"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppRecruitmentCandidate } from "@/contexts/recruitment/interface/http/response-schemas"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /recruitment-candidates/:id/advance — 選考ステージを1つ前進または不採用へ（recruitment:manage）。不正遷移は 409。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      stage: z.enum(["screening", "interview", "offer", "hired", "rejected"]),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const input = {
      session,
      id: validateIntParam(c.req.param("id"), "recruitment candidate"),
    }
    let updated
    if (json.stage === "screening") {
      updated = await new MoveCandidateToScreening(c).execute(input)
    } else if (json.stage === "interview") {
      updated = await new MoveCandidateToInterview(c).execute(input)
    } else if (json.stage === "offer") {
      updated = await new MoveCandidateToOffer(c).execute(input)
    } else if (json.stage === "hired") {
      updated = await new HireCandidate(c).execute(input)
    } else {
      updated = await new RejectCandidate(c).execute(input)
    }

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
