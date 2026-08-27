import { ConflictError } from "@/lib/errors"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { CertificateRequestRepository } from "@/contexts/certificate-request/infrastructure/repositories/certificate-request.repository"
import { UpdateCertificateRequest } from "@/contexts/certificate-request/application/update-certificate-request"
import type { CertificateRequest } from "@/contexts/certificate-request/domain/entities/certificate-request.entity"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/api/http/factory"
import { zAppCertificateRequest } from "@/lib/app-schemas"
import type { AppCertificateRequest } from "@/lib/app-schemas"
import { verifyBearer } from "@/api/http/verify-bearer"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { validateUuidParam } from "@/lib/http/validate-uuid-param"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 証明書発行依頼をレスポンス用の snake_case に整形し、スキーマで検証する。 */
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

// @authorization owner - 本人のリソースに限定する
/** GET /certificate-requests/:id — 証明書発行依頼の詳細（本人のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const certificateRequest = await (async () => {
    const command = {
      certificateRequestId: validateUuidParam(c.req.param("id"), "certificate request"),
      requesterId: viewer.employeeId,
    }

    const certificateRequestRepository = new CertificateRequestRepository(c)

    const certificateRequest = await certificateRequestRepository.findById(
      command.certificateRequestId,
    )

    if (certificateRequest instanceof Error) {
      return new UnexpectedError("failed to find certificate request", {
        cause: certificateRequest,
      })
    }

    if (certificateRequest === null) {
      return new NotFoundError("certificate request not found", "certificate_request_not_found")
    }

    if (certificateRequest.requesterId !== command.requesterId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    return certificateRequest
  })()

  if (certificateRequest instanceof ApplicationError) {
    throw toHttpException(certificateRequest)
  }

  return c.json(toResponseBody(certificateRequest), 200)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /certificate-requests/:id — 証明書発行依頼の内容を変更（本人のみ） */
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

// @authorization owner - 本人のリソースに限定する
/** DELETE /certificate-requests/:id — 証明書発行依頼を取消（本人のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await (async () => {
    const command = {
      certificateRequestId: validateUuidParam(c.req.param("id"), "certificate request"),
      requesterId: viewer.employeeId,
    }

    const certificateRequestRepository = new CertificateRequestRepository(c)

    const current = await certificateRequestRepository.findById(command.certificateRequestId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find certificate request", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("certificate request not found", "certificate_request_not_found")
    }

    if (current.requesterId !== command.requesterId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    if (current.status !== "requested") {
      return new ConflictError("certificate request is not modifiable", "not_modifiable")
    }

    const deleted = await certificateRequestRepository.delete(command.certificateRequestId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete certificate request", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("certificate request is not modifiable", "not_modifiable")
    }

    return { reason: "cancelled" }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
