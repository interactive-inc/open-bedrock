import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { employees, shiftSwapRequests } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, desc, eq, gte, lte } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { alias } from "drizzle-orm/sqlite-core"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppShiftSwapRequestAdminList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { z } from "zod"
import { loadCurrentEmployeeDepartmentNames } from "@/lib/org/current-employee-departments"
import { InternalError } from "@/interface/lib/errors"

const SORT_OPTIONS = {
  date_desc: desc(shiftSwapRequests.date),
  date_asc: asc(shiftSwapRequests.date),
  id_desc: desc(shiftSwapRequests.id),
  id_asc: asc(shiftSwapRequests.id),
} as const

type SortKey = keyof typeof SORT_OPTIONS

/**
 * GET /shift/swap-requests/admin — 全社のシフト交代申請を横断で閲覧する。
 * shift_swap:read:all を持つロール(hr / admin)のみ許可。
 * フィルタ: status / requester_id / target_id / date 範囲(from / to)。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.string().optional(),
      requester_id: z.string().optional(),
      target_id: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
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

    if (session.hasPermission("shift_swap:read:all") === false) {
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
      conditions.push(eq(shiftSwapRequests.status, query.status))
    }

    if (query.requester_id !== undefined && query.requester_id !== "") {
      const requesterId = Number(query.requester_id)

      if (Number.isInteger(requesterId)) {
        conditions.push(eq(shiftSwapRequests.requesterEmployeeId, requesterId))
      }
    }

    if (query.target_id !== undefined && query.target_id !== "") {
      const targetId = Number(query.target_id)

      if (Number.isInteger(targetId)) {
        conditions.push(eq(shiftSwapRequests.targetEmployeeId, targetId))
      }
    }

    if (query.from !== undefined && query.from !== "") {
      conditions.push(gte(shiftSwapRequests.date, query.from))
    }

    if (query.to !== undefined && query.to !== "") {
      conditions.push(lte(shiftSwapRequests.date, query.to))
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const sortQuery = query.sort ?? ""

    const sortKey: SortKey = sortQuery in SORT_OPTIONS ? (sortQuery as SortKey) : "date_desc"

    const requester = alias(employees, "requester")
    const target = alias(employees, "target")

    const rows = await c.var.database
      .select({
        id: shiftSwapRequests.id,
        requesterEmployeeId: shiftSwapRequests.requesterEmployeeId,
        requesterCode: requester.code,
        requesterName: requester.name,
        requesterDeptName: requester.deptName,
        targetEmployeeId: shiftSwapRequests.targetEmployeeId,
        targetCode: target.code,
        targetName: target.name,
        date: shiftSwapRequests.date,
        note: shiftSwapRequests.note,
        status: shiftSwapRequests.status,
        approvedAt: shiftSwapRequests.approvedAt,
      })
      .from(shiftSwapRequests)
      .leftJoin(requester, eq(requester.id, shiftSwapRequests.requesterEmployeeId))
      .leftJoin(target, eq(target.id, shiftSwapRequests.targetEmployeeId))
      .where(where)
      .orderBy(SORT_OPTIONS[sortKey])
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(shiftSwapRequests)
      .where(where)

    const currentDepartments = await loadCurrentEmployeeDepartmentNames(
      c,
      rows.map((row) => row.requesterEmployeeId),
    )
    if (currentDepartments instanceof Error) {
      throw new InternalError("failed to load current departments")
    }

    const responseBody = zAppShiftSwapRequestAdminList.parse({
      data: rows.map((row) => ({
        id: row.id,
        requester_employee_id: row.requesterEmployeeId,
        requester_employee_code: row.requesterCode ?? "",
        requester_name: row.requesterName ?? "",
        requester_dept_name:
          currentDepartments.source === "lifecycle"
            ? (currentDepartments.names.get(row.requesterEmployeeId) ?? null)
            : row.requesterDeptName,
        target_employee_id: row.targetEmployeeId,
        target_employee_code: row.targetCode ?? "",
        target_name: row.targetName ?? "",
        date: row.date,
        note: row.note,
        status: row.status,
        approved_at: row.approvedAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
