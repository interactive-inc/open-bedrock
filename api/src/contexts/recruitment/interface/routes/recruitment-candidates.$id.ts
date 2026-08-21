import { UpdateCandidate } from "@/contexts/recruitment/application/update-candidate"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppRecruitmentCandidate } from "@/lib/app-schemas"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** PUT /recruitment-candidates/:id — 応募者の名前・連絡先・流入元・備考を更新（recruitment:manage）。 */
export const PUT = factory.createHandlers(
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

    const updated = await new UpdateCandidate(c).run({
      session,
      id: validateIntParam(c.req.param("id"), "recruitment candidate"),
      name: json.name,
      email: json.email ?? null,
      source: json.source ?? null,
      note: json.note ?? null,
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
