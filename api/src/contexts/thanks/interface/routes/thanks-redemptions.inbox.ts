import { zAppThanksRedemptionAdminList } from "@/lib/app-schemas"
import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { thanksRedemptions, thanksRewards } from "@/contexts/thanks/infrastructure/schema/thanks"
import { and, count, desc, eq, ne } from "drizzle-orm"
import { loadCurrentEmployeeDepartmentNames } from "@/api/http/utils/current-employee-departments"
import { InternalError } from "@/lib/http/errors"

// @authorization permission - 権限キーで判定する
/** GET /thanks-redemptions/inbox — 承認待ちの交換申請一覧（承認権限が必要・ページング） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("thanks_redemption:approve") === false) {
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
      redemption: thanksRedemptions,
      employeeName: employees.officialName,
      rewardName: thanksRewards.name,
    })
    .from(thanksRedemptions)
    .leftJoin(employees, eq(employees.id, thanksRedemptions.employeeId))
    .leftJoin(thanksRewards, eq(thanksRewards.id, thanksRedemptions.rewardId))
    .where(
      and(
        eq(thanksRedemptions.status, "pending"),
        ne(thanksRedemptions.employeeId, session.employeeId),
      ),
    )
    .orderBy(desc(thanksRedemptions.createdAt))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(thanksRedemptions)
    .where(
      and(
        eq(thanksRedemptions.status, "pending"),
        ne(thanksRedemptions.employeeId, session.employeeId),
      ),
    )

  const currentDepartments = await loadCurrentEmployeeDepartmentNames(
    c,
    rows.map((row) => row.redemption.employeeId),
  )
  if (currentDepartments instanceof Error) {
    throw new InternalError("failed to load current departments")
  }

  const responseBody = zAppThanksRedemptionAdminList.parse({
    data: rows.map(({ redemption, employeeName, rewardName }) => ({
      id: redemption.id,
      employee_id: redemption.employeeId,
      employee_name: employeeName ?? "",
      employee_dept_name: currentDepartments.get(redemption.employeeId) ?? null,
      reward_id: redemption.rewardId,
      reward_name: rewardName ?? "",
      point_cost: redemption.pointCost,
      status: redemption.status,
      created_at: redemption.createdAt,
      decided_at: redemption.decidedAt,
      decider_id: redemption.deciderId,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
