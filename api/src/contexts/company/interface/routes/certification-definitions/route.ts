import { CreateCertification } from "@/contexts/company/application/certification/create-certification"
import { CertificationRepository } from "@/contexts/company/infrastructure/certification/certification-repository"
import { factory } from "@/contexts/company/interface/utils/factory"
import { zAppCertification, zAppCertificationList } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import {
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /certification-definitions — 資格マスタ一覧。認証済みなら誰でも閲覧できる（全認証者）。 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const certifications = await new CertificationRepository(c).findAll()

  if (certifications instanceof Error) {
    throw new InternalError("internal error")
  }

  const responseBody = zAppCertificationList.parse({
    data: certifications.map((certification) => ({
      id: certification.id,
      code: certification.code,
      name: certification.name,
      issuer: certification.issuer,
      description: certification.description,
      created_at: certification.createdAt,
    })),
    total: certifications.length,
  })

  return c.json(responseBody, 200)
})

// @authorization permission - 権限キーで判定する
/** POST /certification-definitions — 資格マスタを作成する。certification:manage が必要。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: z.string().min(1).max(200),
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

    const json = c.req.valid("json")

    const certification = await new CreateCertification(c).run({
      code: json.code,
      name: json.name,
      issuer: json.issuer ?? null,
      description: json.description ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
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

    return c.json(responseBody, 201)
  },
)
