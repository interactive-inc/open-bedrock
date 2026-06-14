import { toFiscalYear } from "@/lib/leave/to-fiscal-year"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { leaveBalances } from "@/schema"
import { and, eq } from "drizzle-orm"

// GET /leave/balance/me — 本人の当年度の休暇残数
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

  const responseBody = rows.map((row) => ({
    fiscal_year: row.fiscalYear,
    leave_type: row.leaveType,
    granted_days: row.grantedDays,
    used_days: row.usedDays,
    remaining_days: row.remainingDays,
  }))

  return c.json(responseBody, 200)
})
