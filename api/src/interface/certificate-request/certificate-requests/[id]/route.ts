import { CancelCertificateRequest } from "@/application/certificate-request/cancel-certificate-request"
import { GetCertificateRequest } from "@/application/certificate-request/get-certificate-request"
import { UpdateCertificateRequest } from "@/application/certificate-request/update-certificate-request"
import type { CertificateRequest } from "@/domain/certificate-request/certificate-request.entity"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/lib/factory"
import { zAppCertificateRequest } from "@/lib/app-schemas"
import type { AppCertificateRequest } from "@/lib/app-schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateUuidParam } from "@/interface/shared/validate-uuid-param"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 証明書発行依頼をレスポンス用の snake_case に整形し、スキーマで検証する。
function toResponseBody(certificateRequest: CertificateRequest): AppCertificateRequest {
  return zAppCertificateRequest.parse({
    id: certificateRequest.id,
    requester_id: certificateRequest.requesterId,
    certificate_type: certificateRequest.certificateType,
    submit_to: certificateRequest.submitTo,
    needed_by: certificateRequest.neededBy,
    note: certificateRequest.note,
    status: certificateRequest.status,
    created_at: certificateRequest.createdAt,
  })
}

// GET /certificate-requests/:id — 証明書発行依頼の詳細（本人のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const certificateRequest = await new GetCertificateRequest(c).run({
    certificateRequestId: validateUuidParam(c.req.param("id"), "certificate request"),
    requesterId: viewer.employeeId,
  })

  if (certificateRequest instanceof ApplicationError) {
    throw toHttpException(certificateRequest)
  }

  return c.json(toResponseBody(certificateRequest), 200)
})

// PUT /certificate-requests/:id — 証明書発行依頼の内容を変更（本人のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      certificate_type: z.string().min(1).max(200),
      submit_to: z.string().max(500).nullable().optional(),
      needed_by: isoDate.nullable().optional(),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const certificateRequest = await new UpdateCertificateRequest(c).run({
      certificateRequestId: validateUuidParam(c.req.param("id"), "certificate request"),
      requesterId: viewer.employeeId,
      certificateType: json.certificate_type,
      submitTo: json.submit_to ?? null,
      neededBy: json.needed_by ?? null,
      note: json.note ?? null,
    })

    if (certificateRequest instanceof ApplicationError) {
      throw toHttpException(certificateRequest)
    }

    return c.json(toResponseBody(certificateRequest), 200)
  },
)

// DELETE /certificate-requests/:id — 証明書発行依頼を取消（本人のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new CancelCertificateRequest(c).run({
    certificateRequestId: validateUuidParam(c.req.param("id"), "certificate request"),
    requesterId: viewer.employeeId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
