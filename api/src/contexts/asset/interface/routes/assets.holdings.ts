import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { assetLendings, assets } from "@/contexts/asset/infrastructure/schema/asset"
import { readCompanyEmployeeProfiles } from "@/contexts/company/interface/operations/read-company-employee-profiles"
import { and, asc, count, eq, isNotNull, isNull } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
import { zAppAssetHoldingList } from "@/contexts/asset/interface/http/response-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"

// @authorization permission - 権限キーで判定する
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
      holderId: assets.holderEmployeeId,
      lentAt: assetLendings.lentAt,
    })
    .from(assets)
    .leftJoin(
      assetLendings,
      and(eq(assetLendings.assetCode, assets.code), isNull(assetLendings.returnedAt)),
    )
    .where(and(eq(assets.status, "lent"), isNotNull(assets.holderEmployeeId)))
    .orderBy(asc(assets.code))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(assets)
    .where(and(eq(assets.status, "lent"), isNotNull(assets.holderEmployeeId)))

  // 借り手の従業員 code と表示名は、Company の従業員ごとの正本から読む。
  const profiles = await readCompanyEmployeeProfiles({
    database: c.env.DB,
    employeeIds: rows.flatMap((row) => (row.holderId === null ? [] : [row.holderId])),
    now: c.env.NOW,
    timeZone: c.env.COMPANY_TIME_ZONE,
  })
  if (profiles instanceof Error) throw profiles

  const responseBody = zAppAssetHoldingList.parse({
    data: rows.map((row) => ({
      asset_code: row.assetCode,
      asset_name: row.assetName,
      kind: row.kind,
      holder_employee_id: row.holderId,
      holder_employee_code:
        row.holderId === null ? null : (profiles.get(row.holderId)?.employeeCode ?? null),
      holder_employee_name:
        row.holderId === null ? "" : (profiles.get(row.holderId)?.officialName ?? ""),
      lent_at: row.lentAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
