import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { resignations } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppResignationList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { z } from "zod"

/** 並び順のホワイトリスト。未知の値は created_at desc にフォールバックする。 */
const SORT_OPTIONS = {
  created_at_desc: desc(resignations.createdAt),
  created_at_asc: asc(resignations.createdAt),
} as const

type SortKey = keyof typeof SORT_OPTIONS

// @authorization permission - 権限キーで判定する
/**
 * GET /resignations/admin — 全社の退職手続きを横断で閲覧する管理画面用の一覧。
 * resignation:read:all を持つロール(hr / admin / auditor)のみ許可。
 * フィルタ: employee_id / status。
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

    if (session.hasPermission("resignation:read:all") === false) {
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
      conditions.push(eq(resignations.status, query.status))
    }

    if (query.employee_id !== undefined && query.employee_id !== "") {
      const employeeId = Number(query.employee_id)

      if (Number.isInteger(employeeId)) {
        conditions.push(eq(resignations.employeeId, employeeId))
      }
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const sortQuery = query.sort ?? ""

    const sortKey: SortKey = Object.hasOwn(SORT_OPTIONS, sortQuery)
      ? (sortQuery as SortKey)
      : "created_at_desc"

    const rows = await c.var.database
      .select()
      .from(resignations)
      .where(where)
      .orderBy(SORT_OPTIONS[sortKey])
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(resignations)
      .where(where)

    const responseBody = zAppResignationList.parse({
      data: rows.map((row) => ({
        id: row.id,
        employee_id: row.employeeId,
        resignation_date: row.resignationDate,
        last_working_date: row.lastWorkingDate,
        reason: row.reason,
        status: row.status,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
