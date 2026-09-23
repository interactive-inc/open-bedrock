import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { readCompanyEmployeeProfiles } from "@/contexts/company/interface/operations/read-company-employee-profiles"
import { shiftSwapRequests } from "@/contexts/shift/infrastructure/schema/shift"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, desc, eq, gte, lte } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
import { zAppShiftSwapRequestAdminList } from "@/contexts/shift/interface/http/response-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { z } from "zod"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { loadCurrentEmployeeDepartmentNames } from "@/api/http/company-employees/current-employee-departments"
import { InternalError } from "@/lib/http/errors"

const SORT_OPTIONS = {
  date_desc: desc(shiftSwapRequests.date),
  date_asc: asc(shiftSwapRequests.date),
  id_desc: desc(shiftSwapRequests.id),
  id_asc: asc(shiftSwapRequests.id),
} as const

type SortKey = keyof typeof SORT_OPTIONS

// @authorization permission - 権限キーで判定する
/**
 * GET /shift-swap-requests/admin — 全社のシフト交代申請を横断で閲覧する。
 * shift_swap:read:all を持つロール(hr / admin)のみ許可。
 * フィルタ: status / requester_id / target_id / date 範囲(from / to)。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.string().optional(),
      requester_id: zEmployeeId.optional(),
      target_id: zEmployeeId.optional(),
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

    if (query.requester_id !== undefined) {
      conditions.push(eq(shiftSwapRequests.requesterEmployeeId, query.requester_id))
    }

    if (query.target_id !== undefined) {
      conditions.push(eq(shiftSwapRequests.targetEmployeeId, query.target_id))
    }

    if (query.from !== undefined && query.from !== "") {
      conditions.push(gte(shiftSwapRequests.date, query.from))
    }

    if (query.to !== undefined && query.to !== "") {
      conditions.push(lte(shiftSwapRequests.date, query.to))
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const sortQuery = query.sort ?? ""

    const sortKey: SortKey = Object.hasOwn(SORT_OPTIONS, sortQuery)
      ? (sortQuery as SortKey)
      : "date_desc"

    const rows = await c.var.database
      .select({
        id: shiftSwapRequests.id,
        requesterEmployeeId: shiftSwapRequests.requesterEmployeeId,
        targetEmployeeId: shiftSwapRequests.targetEmployeeId,
        date: shiftSwapRequests.date,
        note: shiftSwapRequests.note,
        status: shiftSwapRequests.status,
        approvedAt: shiftSwapRequests.approvedAt,
      })
      .from(shiftSwapRequests)
      .where(where)
      .orderBy(SORT_OPTIONS[sortKey])
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(shiftSwapRequests)
      .where(where)

    // 従業員の従業員 code と表示名は、Company の従業員ごとの正本から読む。
    const profiles = await readCompanyEmployeeProfiles({
      database: c.env.DB,
      employeeIds: rows.flatMap((row) => [row.requesterEmployeeId, row.targetEmployeeId]),
      now: c.env.NOW,
      timeZone: c.env.COMPANY_TIME_ZONE,
    })
    if (profiles instanceof Error) throw profiles

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
        requester_employee_code: profiles.get(row.requesterEmployeeId)?.employeeCode ?? "",
        requester_name: profiles.get(row.requesterEmployeeId)?.officialName ?? "",
        requester_dept_name: currentDepartments.get(row.requesterEmployeeId) ?? null,
        target_employee_id: row.targetEmployeeId,
        target_employee_code: profiles.get(row.targetEmployeeId)?.employeeCode ?? "",
        target_name: profiles.get(row.targetEmployeeId)?.officialName ?? "",
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
