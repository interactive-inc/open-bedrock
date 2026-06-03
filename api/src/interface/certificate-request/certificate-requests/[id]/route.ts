import { CancelCertificateRequest } from "@/application/certificate-request/cancel-certificate-request"
import { GetCertificateRequest } from "@/application/certificate-request/get-certificate-request"
import { UpdateCertificateRequest } from "@/application/certificate-request/update-certificate-request"
import type { CertificateRequest } from "@/domain/certificate-request/certificate-request"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 証明書発行依頼をレスポンス用の snake_case に整形する。
function toResponseBody(certificateRequest: CertificateRequest) {
  return {
    id: certificateRequest.id,
    requester_id: certificateRequest.requesterId,
    certificate_type: certificateRequest.certificateType,
    submit_to: certificateRequest.submitTo,
    needed_by: certificateRequest.neededBy,
    note: certificateRequest.note,
    status: certificateRequest.status,
    created_at: certificateRequest.createdAt,
  }
}

// GET /certificate-requests/:id — 証明書発行依頼の詳細（本人のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const certificateRequest = await new GetCertificateRequest(c).run({
    certificateRequestId: c.req.param("id") ?? "",
    requesterId: viewer.employeeId,
  })

  if (certificateRequest instanceof Error) {
    throw new InternalError("failed to load certificate request")
  }

  if ("reason" in certificateRequest) {
    if (certificateRequest.reason === "certificate_request_not_found") {
      throw new NotFoundError("certificate request not found")
    }

    throw new ForbiddenError("not the requester")
  }

  return c.json(toResponseBody(certificateRequest), 200)
})

// PUT /certificate-requests/:id — 証明書発行依頼の内容を変更（本人のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      certificate_type: z.string().min(1),
      submit_to: z.string().nullable().optional(),
      needed_by: z.string().nullable().optional(),
      note: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const certificateRequest = await new UpdateCertificateRequest(c).run({
      certificateRequestId: c.req.param("id") ?? "",
      requesterId: viewer.employeeId,
      certificateType: json.certificate_type,
      submitTo: json.submit_to ?? null,
      neededBy: json.needed_by ?? null,
      note: json.note ?? null,
    })

    if (certificateRequest instanceof Error) {
      throw new InternalError("failed to update certificate request")
    }

    if ("reason" in certificateRequest) {
      if (certificateRequest.reason === "certificate_request_not_found") {
        throw new NotFoundError("certificate request not found")
      }

      throw new ForbiddenError("not the requester")
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
    certificateRequestId: c.req.param("id") ?? "",
    requesterId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel certificate request")
  }

  if (result.reason === "certificate_request_not_found") {
    throw new NotFoundError("certificate request not found")
  }

  if (result.reason === "not_requester") {
    throw new ForbiddenError("not the requester")
  }

  return c.body(null, 204)
})
