import { ListMyAntisocialChecks } from "@/application/antisocial-check/list-my-antisocial-checks"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppAntisocialCheckList } from "@/lib/app-schemas"
import { antisocialChecks } from "@/schema"
import { count, eq } from "drizzle-orm"

/** GET /antisocial-checks/me — 申請者本人の反社チェック申請一覧 */
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

  const antisocialCheckRows = await new ListMyAntisocialChecks(c).run({
    requesterId: viewer.employeeId,
    limit,
    offset,
  })

  if (antisocialCheckRows instanceof ApplicationError) {
    throw toHttpException(antisocialCheckRows)
  }

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(antisocialChecks)
    .where(eq(antisocialChecks.requesterId, viewer.employeeId))

  const responseBody = zAppAntisocialCheckList.parse({
    data: antisocialCheckRows.map((antisocialCheck) => ({
      id: antisocialCheck.id,
      requester_id: antisocialCheck.requesterId,
      partner_name: antisocialCheck.partnerName,
      partner_address: antisocialCheck.partnerAddress,
      representative_name: antisocialCheck.representativeName,
      result: antisocialCheck.result,
      status: antisocialCheck.status,
      created_at: antisocialCheck.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
