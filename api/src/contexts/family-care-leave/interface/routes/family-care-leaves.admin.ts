import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { familyCareLeaves } from "@/contexts/family-care-leave/infrastructure/schema/family-care-leave"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
import { zAppFamilyCareLeaveList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { z } from "zod"

/** 並び順のホワイトリスト。未知の値は created_at desc にフォールバックする。 */
const SORT_OPTIONS = {
  created_at_desc: desc(familyCareLeaves.createdAt),
  created_at_asc: asc(familyCareLeaves.createdAt),
} as const

type SortKey = keyof typeof SORT_OPTIONS

// @authorization permission - 権限キーで判定する
/**
 * GET /family-care-leaves/admin — 全社の産休・育休・介護休業の申出を横断で閲覧する管理画面用の一覧。
 * family_care_leave:read:all を持つロール(hr / admin / auditor)のみ許可。
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

    if (session.hasPermission("family_care_leave:read:all") === false) {
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
      conditions.push(eq(familyCareLeaves.status, query.status))
    }

    if (query.employee_id !== undefined && query.employee_id !== "") {
      const employeeId = Number(query.employee_id)

      if (Number.isInteger(employeeId)) {
        conditions.push(eq(familyCareLeaves.employeeId, employeeId))
      }
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const sortQuery = query.sort ?? ""

    const sortKey: SortKey = Object.hasOwn(SORT_OPTIONS, sortQuery)
      ? (sortQuery as SortKey)
      : "created_at_desc"

    const rows = await c.var.database
      .select()
      .from(familyCareLeaves)
      .where(where)
      .orderBy(SORT_OPTIONS[sortKey])
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(familyCareLeaves)
      .where(where)

    const responseBody = zAppFamilyCareLeaveList.parse({
      data: rows.map((row) => ({
        id: row.id,
        employee_id: row.employeeId,
        leave_kind: row.leaveKind,
        start_date: row.startDate,
        end_date: row.endDate,
        note: row.note,
        status: row.status,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
