import { toFiscalYear } from "@/contexts/leave/domain/to-fiscal-year"
import { canReadLeaveOf } from "@/contexts/leave/interface/http/leave-requests/can-read-leave-of"
import { resolveEmployeeRelation } from "@/contexts/company/application/organization/resolve-employee-relation"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import {
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { zAppLeaveBalanceList } from "@/lib/app-schemas"
import { leaveBalances } from "@/contexts/leave/infrastructure/schema/leave"
import { and, eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/**
 * GET /leave-balances — 他者の当年度の休暇残数を employee_id 指定で閲覧する。
 * self→all→reports→department のスコープ判定。本人分は /leave/balance/me を使う。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", z.object({ employee_id: z.string().optional() })),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

    const requestedEmployeeId = (() => {
      if (query.employee_id === undefined) return null
      const parsed = Number(query.employee_id)
      return Number.isInteger(parsed) ? parsed : null
    })()

    const targetEmployeeId = requestedEmployeeId === null ? session.employeeId : requestedEmployeeId

    const relation = await resolveEmployeeRelation({
      c,
      viewerEmployeeId: session.employeeId,
      targetEmployeeId,
    })

    if (relation instanceof Error) {
      throw new InternalError("failed to resolve employee relation")
    }

    if (canReadLeaveOf(session, relation) === false) {
      throw new ForbiddenError()
    }

    const fiscalYear = toFiscalYear(c.env.NOW ?? new Date().toISOString())

    if (fiscalYear === null) {
      throw new InternalError("invalid server time")
    }

    const rows = await c.var.database
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.employeeId, targetEmployeeId),
          eq(leaveBalances.fiscalYear, fiscalYear),
        ),
      )

    const responseBody = zAppLeaveBalanceList.parse(
      rows.map((row) => ({
        fiscal_year: row.fiscalYear,
        leave_type: row.leaveType,
        granted_days: row.grantedDays,
        used_days: row.usedDays,
        remaining_days: row.remainingDays,
      })),
    )

    return c.json(responseBody, 200)
  },
)
