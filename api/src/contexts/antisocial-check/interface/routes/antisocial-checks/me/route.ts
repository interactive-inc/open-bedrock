import { ListMyAntisocialChecks } from "@/contexts/antisocial-check/application/list-my-antisocial-checks"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { zAppAntisocialCheckList } from "@/lib/app-schemas"
import { antisocialChecks } from "@/contexts/antisocial-check/infrastructure/schema/antisocial-check"
import { count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
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
