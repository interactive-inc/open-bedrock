import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { assetLendings, assets, employees } from "@/schema"
import { and, asc, count, eq, isNull } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppAssetHoldingList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"

/**
 * GET /assets/holdings — 現在貸出中の資産を「誰が何を持っているか」で横断一覧する。
 * 資産管理権限（asset:manage）を持つロールのみ許可。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("asset:manage") === false) {
    throw new ForbiddenError()
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
    .select({
      assetCode: assets.code,
      assetName: assets.name,
      kind: assets.kind,
      holderId: employees.id,
      holderCode: employees.code,
      holderName: employees.name,
      lentAt: assetLendings.lentAt,
    })
    .from(assets)
    .innerJoin(employees, eq(employees.id, assets.holderEmployeeId))
    .leftJoin(
      assetLendings,
      and(eq(assetLendings.assetCode, assets.code), isNull(assetLendings.returnedAt)),
    )
    .where(eq(assets.status, "lent"))
    .orderBy(asc(assets.code))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(assets)
    .innerJoin(employees, eq(employees.id, assets.holderEmployeeId))
    .where(eq(assets.status, "lent"))

  const responseBody = zAppAssetHoldingList.parse({
    data: rows.map((row) => ({
      asset_code: row.assetCode,
      asset_name: row.assetName,
      kind: row.kind,
      holder_employee_id: row.holderId,
      holder_employee_code: row.holderCode,
      holder_employee_name: row.holderName,
      lent_at: row.lentAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
