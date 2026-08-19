import { factory } from "@/contexts/company/interface/utils/factory"
import { zAppAssetList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { assets } from "@/contexts/asset/infrastructure/schema/asset"
import { and, asc, count, eq } from "drizzle-orm"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"

// @authorization owner - 本人のリソースに限定する
/** GET /assets/lent/me — 本人が現在借り受けている資産一覧 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
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

  const rows = await c.var.database
    .select()
    .from(assets)
    .where(and(eq(assets.status, "lent"), eq(assets.holderEmployeeId, session.employeeId)))
    .orderBy(asc(assets.code))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(assets)
    .where(and(eq(assets.status, "lent"), eq(assets.holderEmployeeId, session.employeeId)))

  const responseBody = zAppAssetList.parse({
    data: rows.map((row) => ({
      code: row.code,
      name: row.name,
      kind: row.kind,
      serial: row.serial,
      purchased_on: row.purchasedOn,
      status: row.status,
      holder_employee_id: row.holderEmployeeId,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
