import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { businessTrips } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppBusinessTripList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { z } from "zod"

/** 並び順のホワイトリスト。未知の値は created_at desc にフォールバックする。 */
const SORT_OPTIONS = {
  created_at_desc: desc(businessTrips.createdAt),
  created_at_asc: asc(businessTrips.createdAt),
} as const

type SortKey = keyof typeof SORT_OPTIONS

// @authorization permission - 権限キーで判定する
/**
 * GET /business-trips/admin — 全社の出張申請を横断で閲覧する管理画面用の一覧。
 * business_trip:read:all を持つロール(hr / admin / auditor)のみ許可。
 * フィルタ: employee_id(出張者) / status。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.string().optional(),
      employee_id: z.string().optional(),
      sort: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("business_trip:read:all") === false) {
      throw new ForbiddenError()
    }

    const query = c.req.valid("query")

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

    const conditions: Array<SQL> = []

    if (query.status !== undefined && query.status !== "") {
      conditions.push(eq(businessTrips.status, query.status))
    }

    if (query.employee_id !== undefined && query.employee_id !== "") {
      const employeeId = Number(query.employee_id)

      if (Number.isInteger(employeeId)) {
        conditions.push(eq(businessTrips.travelerId, employeeId))
      }
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const sortQuery = query.sort ?? ""

    const sortKey: SortKey = sortQuery in SORT_OPTIONS ? (sortQuery as SortKey) : "created_at_desc"

    const rows = await c.var.database
      .select()
      .from(businessTrips)
      .where(where)
      .orderBy(SORT_OPTIONS[sortKey])
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(businessTrips)
      .where(where)

    const responseBody = zAppBusinessTripList.parse({
      data: rows.map((row) => ({
        id: row.id,
        traveler_id: row.travelerId,
        destination: row.destination,
        start_date: row.startDate,
        end_date: row.endDate,
        purpose: row.purpose,
        estimated_cost: row.estimatedCost,
        status: row.status,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
