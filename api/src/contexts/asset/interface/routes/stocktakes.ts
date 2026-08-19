import { StartStocktake } from "@/contexts/asset/application/stocktake/start-stocktake"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { StocktakeRepository } from "@/contexts/asset/infrastructure/stocktake/stocktake-repository"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppStocktake, zAppStocktakeList } from "@/lib/app-schemas"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /stocktakes — 棚卸しセッション一覧（新しい順。status で絞り込める） */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["open", "closed"]).optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

    const status = query.status ?? null

    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })

    const offset = toBoundedInt({
      raw: query.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })

    const repository = new StocktakeRepository(c)

    const stocktakes = await repository.listByStatus({ status, limit, offset })

    if (stocktakes instanceof Error) {
      throw stocktakes
    }

    const total = await repository.countByStatus(status)

    if (total instanceof Error) {
      throw total
    }

    const data = []

    for (const stocktake of stocktakes) {
      const counts = await repository.countsFor(stocktake.id)

      if (counts instanceof Error) {
        throw counts
      }

      data.push({
        id: stocktake.id,
        name: stocktake.name,
        target_date: stocktake.targetDate,
        status: stocktake.status,
        created_at: stocktake.createdAt,
        closed_at: stocktake.closedAt,
        checked_count: counts.checkedCount,
        total_count: counts.totalCount,
      })
    }

    const responseBody = zAppStocktakeList.parse({ data, total })

    return c.json(responseBody, 200)
  },
)

// @authorization service - session を application service に渡して判定する
/** POST /stocktakes — 棚卸しセッションを開始（名称・対象日。権限が必要） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(200),
      target_date: isoDate,
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const started = await new StartStocktake(c).run({
      session: session,
      name: json.name,
      targetDate: json.target_date,
      now: c.env.NOW ?? new Date().toISOString(),
    })

    if (started instanceof ApplicationError) {
      throw toHttpException(started)
    }

    const repository = new StocktakeRepository(c)

    const counts = await repository.countsFor(started.id)

    if (counts instanceof Error) {
      throw counts
    }

    const items = await repository.itemsFor(started.id)

    if (items instanceof Error) {
      throw items
    }

    const responseBody = zAppStocktake.parse({
      id: started.id,
      name: started.name,
      target_date: started.targetDate,
      status: started.status,
      created_at: started.createdAt,
      closed_at: started.closedAt,
      checked_count: counts.checkedCount,
      total_count: counts.totalCount,
      items: items.map((item) => ({
        asset_code: item.assetCode,
        asset_name: item.assetName,
        kind: item.kind,
        checked_at: item.checkedAt,
        checker_employee_id: item.checkerEmployeeId,
        location_note: item.locationNote,
      })),
    })

    return c.json(responseBody, 201)
  },
)
