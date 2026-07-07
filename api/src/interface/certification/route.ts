import { CreateCertification } from "@/application/certification/create-certification"
import { CertificationRepository } from "@/infrastructure/certification/certification-repository"
import { canManageCertifications } from "@/lib/certification/can-manage-certifications"
import { factory } from "@/lib/factory"
import { zAppCertification, zAppCertificationList } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// GET /certifications — 資格マスタ一覧。認証済みなら誰でも閲覧できる（全認証者）。
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

// POST /certifications — 資格マスタを作成する。certification:manage が必要。
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

    if (canManageCertifications(session) === false) {
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
