import { UpdateCertification } from "@/contexts/company/application/certification/update-certification"
import { factory } from "@/contexts/company/interface/utils/factory"
import { zAppCertification } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** PUT /certification-definitions/:id — 資格マスタの名称・発行元・説明を更新する。certification:manage が必要。 */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(500),
      issuer: z.string().max(500).nullable().optional(),
      description: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("certification:manage") === false) {
      throw new ForbiddenError()
    }

    const id = Number(c.req.param("id"))

    if (Number.isInteger(id) === false) {
      throw new BadRequestError("invalid parameter")
    }

    const json = c.req.valid("json")

    const certification = await new UpdateCertification(c).run({
      id: id,
      name: json.name,
      issuer: json.issuer ?? null,
      description: json.description ?? null,
    })

    if (certification instanceof Error) {
      throw toHttpException(certification)
    }

    const responseBody = zAppCertification.parse({
      id: certification.id,
      code: certification.code,
      name: certification.name,
      issuer: certification.issuer,
      description: certification.description,
      created_at: certification.createdAt,
    })

    return c.json(responseBody, 200)
  },
)
