import { ListMyCertificateRequests } from "@/application/certificate-request/list-my-certificate-requests"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

// GET /certificate-requests/me — 依頼者本人の証明書発行依頼一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const certificateRequests = await new ListMyCertificateRequests(c).run({
    requesterId: viewer.employeeId,
  })

  if (certificateRequests instanceof Error) {
    throw new InternalError("failed to load certificate requests")
  }

  const responseBody = certificateRequests.map((certificateRequest) => ({
    id: certificateRequest.id,
    requester_id: certificateRequest.requesterId,
    certificate_type: certificateRequest.certificateType,
    submit_to: certificateRequest.submitTo,
    needed_by: certificateRequest.neededBy,
    note: certificateRequest.note,
    status: certificateRequest.status,
    created_at: certificateRequest.createdAt,
  }))

  return c.json(responseBody, 200)
})
