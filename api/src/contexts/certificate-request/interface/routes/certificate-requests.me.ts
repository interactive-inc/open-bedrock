import { UnexpectedError } from "@/lib/errors"
import { CertificateRequestRepository } from "@/contexts/certificate-request/infrastructure/certificate-request.repository"

import { ApplicationError } from "@/lib/errors"
import { factory } from "@/api/http/factory"
import { zAppCertificateRequestList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { certificateRequests } from "@/contexts/certificate-request/infrastructure/schema/certificate-request"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /certificate-requests/me — 依頼者本人の証明書発行依頼一覧 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const certificateRequestRows = await (async () => {
    const command = {
      requesterId: viewer.employeeId,
      limit,
      offset,
    }

    const certificateRequestRepository = new CertificateRequestRepository(c)

    const certificateRequests = await certificateRequestRepository.findByRequesterId({
      requesterId: command.requesterId,
      limit: command.limit,
      offset: command.offset,
    })

    if (certificateRequests instanceof Error) {
      return new UnexpectedError("failed to find certificate requests", {
        cause: certificateRequests,
      })
    }

    return certificateRequests
  })()

  if (certificateRequestRows instanceof ApplicationError) {
    throw toHttpException(certificateRequestRows)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(certificateRequests)
    .where(eq(certificateRequests.requesterId, viewer.employeeId))

  const responseBody = zAppCertificateRequestList.parse({
    data: certificateRequestRows.map((certificateRequest) => ({
      id: certificateRequest.id,
      requester_id: certificateRequest.requesterId,
      certificate_type: certificateRequest.certificateType,
      submit_to: certificateRequest.submitTo,
      needed_by: certificateRequest.neededBy,
      note: certificateRequest.note,
      status: certificateRequest.status,
      created_at: certificateRequest.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
