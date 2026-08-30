import { toFiscalYear } from "@/contexts/leave/domain/definitions/fiscal-year.definition"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { InternalError, UnauthorizedError } from "@/lib/http/errors"
import { zAppLeaveBalanceList } from "@/contexts/leave/interface/http/response-schemas"
import { leaveBalances } from "@/contexts/leave/infrastructure/schema/leave"
import { and, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /leave-balances/me — 本人の当年度の休暇残数 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
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
        eq(leaveBalances.employeeId, session.employeeId),
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
})
