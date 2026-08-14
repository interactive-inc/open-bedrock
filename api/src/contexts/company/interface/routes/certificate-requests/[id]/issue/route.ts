import { AdvanceCertificateRequest } from "@/contexts/company/application/certificate-request/advance-certificate-request"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppCertificateRequest } from "@/lib/app-schemas"
import { factory } from "@/contexts/company/interface/utils/factory"
import { validateUuidParam } from "@/contexts/company/interface/utils/validate-uuid-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"

// @authorization service - session を application service に渡して判定する
/** POST /certificate-requests/:id/issue — 人事が証明書発行依頼を発行済みにする */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new AdvanceCertificateRequest(c).run({
    session: session,
    certificateRequestId: validateUuidParam(c.req.param("id"), "certificate request"),
    action: "issue",
  })

  if (updated instanceof ApplicationError) {
    throw toHttpException(updated)
  }

  const responseBody = zAppCertificateRequest.parse({
    id: updated.id,
    requester_id: updated.requesterId,
    certificate_type: updated.certificateType,
    submit_to: updated.submitTo,
    needed_by: updated.neededBy,
    note: updated.note,
    status: updated.status,
    created_at: updated.createdAt,
  })

  return c.json(responseBody, 200)
})
