import { ListMyCertificateRequests } from "@/application/certificate-request/list-my-certificate-requests"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { certificateRequests } from "@/schema"
import { count, eq } from "drizzle-orm"

// GET /certificate-requests/me — 依頼者本人の証明書発行依頼一覧
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

  const certificateRequestRows = await new ListMyCertificateRequests(c).run({
    requesterId: viewer.employeeId,
    limit,
    offset,
  })

  if (certificateRequestRows instanceof Error) {
    throw new InternalError("failed to load certificate requests")
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(certificateRequests)
    .where(eq(certificateRequests.requesterId, viewer.employeeId))

  const responseBody = certificateRequestRows.map((certificateRequest) => ({
    id: certificateRequest.id,
    requester_id: certificateRequest.requesterId,
    certificate_type: certificateRequest.certificateType,
    submit_to: certificateRequest.submitTo,
    needed_by: certificateRequest.neededBy,
    note: certificateRequest.note,
    status: certificateRequest.status,
    created_at: certificateRequest.createdAt,
  }))

  return c.json({ data: responseBody, total: totalRows.at(0)?.total ?? 0 }, 200)
})
