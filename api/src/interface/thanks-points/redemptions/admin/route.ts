import { canViewAllRedemptions } from "@/lib/thanks-points/can-view-all-redemptions"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, thanksRedemptions, thanksRewards } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, desc, eq, gte, lte } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppThanksRedemptionAdminList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { z } from "zod"
import { loadCurrentEmployeeDepartmentNames } from "@/lib/org/current-employee-departments"
import { InternalError } from "@/interface/lib/errors"

const SORT_OPTIONS = {
  created_at_desc: desc(thanksRedemptions.createdAt),
  created_at_asc: asc(thanksRedemptions.createdAt),
} as const

type SortKey = keyof typeof SORT_OPTIONS

// GET /thanks/redemptions/admin — 全社のサンクス交換申請を横断で閲覧する。
// thanks_redemption:read:all を持つロール(hr / admin)のみ許可。
// フィルタ: status / employee_id / reward_id / created_at 範囲。
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["pending", "rejected", "fulfilled"]).optional(),
      employee_id: z.string().optional(),
      reward_id: z.string().optional(),
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

    if (canViewAllRedemptions(session) === false) {
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

    if (query.status !== undefined) {
      conditions.push(eq(thanksRedemptions.status, query.status))
    }

    if (query.employee_id !== undefined && query.employee_id !== "") {
      const employeeId = Number(query.employee_id)

      if (Number.isInteger(employeeId)) {
        conditions.push(eq(thanksRedemptions.employeeId, employeeId))
      }
    }

    if (query.reward_id !== undefined && query.reward_id !== "") {
      const rewardId = Number(query.reward_id)

      if (Number.isInteger(rewardId)) {
        conditions.push(eq(thanksRedemptions.rewardId, rewardId))
      }
    }

    if (query.from !== undefined && query.from !== "") {
      conditions.push(gte(thanksRedemptions.createdAt, query.from))
    }

    if (query.to !== undefined && query.to !== "") {
      conditions.push(lte(thanksRedemptions.createdAt, query.to))
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const sortQuery = query.sort ?? ""

    const sortKey: SortKey = sortQuery in SORT_OPTIONS ? (sortQuery as SortKey) : "created_at_desc"

    const rows = await c.var.database
      .select({
        id: thanksRedemptions.id,
        employeeId: thanksRedemptions.employeeId,
        employeeName: employees.name,
        employeeDeptName: employees.deptName,
        rewardId: thanksRedemptions.rewardId,
        rewardName: thanksRewards.name,
        pointCost: thanksRedemptions.pointCost,
        status: thanksRedemptions.status,
        createdAt: thanksRedemptions.createdAt,
        decidedAt: thanksRedemptions.decidedAt,
        deciderId: thanksRedemptions.deciderId,
      })
      .from(thanksRedemptions)
      .leftJoin(employees, eq(employees.id, thanksRedemptions.employeeId))
      .leftJoin(thanksRewards, eq(thanksRewards.id, thanksRedemptions.rewardId))
      .where(where)
      .orderBy(SORT_OPTIONS[sortKey])
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(thanksRedemptions)
      .where(where)

    const currentDepartments = await loadCurrentEmployeeDepartmentNames(
      c,
      rows.map((row) => row.employeeId),
    )
    if (currentDepartments instanceof Error) {
      throw new InternalError("failed to load current departments")
    }

    const responseBody = zAppThanksRedemptionAdminList.parse({
      data: rows.map((row) => ({
        id: row.id,
        employee_id: row.employeeId,
        employee_name: row.employeeName ?? "",
        employee_dept_name:
          currentDepartments.source === "lifecycle"
            ? (currentDepartments.names.get(row.employeeId) ?? null)
            : row.employeeDeptName,
        reward_id: row.rewardId,
        reward_name: row.rewardName ?? "",
        point_cost: row.pointCost,
        status: row.status,
        created_at: row.createdAt,
        decided_at: row.decidedAt,
        decider_id: row.deciderId,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
