import { canDecideApplication } from "@/lib/application/can-decide-application"
import { canDecideExpense } from "@/lib/expense/can-decide-expense"
import { canDecideLeave } from "@/lib/leave/can-decide-leave"
import { canApproveShiftSwap } from "@/lib/shift/can-approve-shift-swap"
import { canDecideRedemption } from "@/lib/thanks-points/can-decide-redemption"
import { UnauthorizedError } from "@/interface/lib/errors"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  applications,
  applicationTemplates,
  expenses,
  leaveRequests,
  shiftSwapRequests,
  thanksRedemptions,
} from "@/schema"
import { and, count, eq, like, ne, or } from "drizzle-orm"

// GET /inbox/counts — 受信箱ごとの未処理件数を一括取得する。
// ユーザーの権限に応じて各カウントを返す（権限がない inbox は 0）。
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  // --- applications ---
  // applicationTemplates.approverRoles に自分のロールが含まれるか、
  // approverRoles が空で canDecideApplication を満たす場合にカウントする。
  const roleMatches = session.roleKeys.map((roleKey) =>
    like(applicationTemplates.approverRoles, `%"${roleKey}"%`),
  )

  const isPrivileged = canDecideApplication(session)

  const pendingWithRole = and(
    eq(applications.status, "pending"),
    or(isPrivileged ? eq(applicationTemplates.approverRoles, "[]") : undefined, ...roleMatches),
  )

  const applicationCountQuery = c.var.database
    .select({ total: count() })
    .from(applications)
    .innerJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
    .where(pendingWithRole)

  // --- expenses ---
  const expenseCountQuery = canDecideExpense(session)
    ? c.var.database
        .select({ total: count() })
        .from(expenses)
        .where(eq(expenses.status, "pending"))
    : null

  // --- leave requests ---
  const leaveCountQuery = canDecideLeave(session)
    ? c.var.database
        .select({ total: count() })
        .from(leaveRequests)
        .where(eq(leaveRequests.status, "pending"))
    : null

  // --- shift swap requests ---
  const shiftCountQuery = canApproveShiftSwap(session)
    ? c.var.database
        .select({ total: count() })
        .from(shiftSwapRequests)
        .where(
          and(
            eq(shiftSwapRequests.status, "pending"),
            ne(shiftSwapRequests.requesterEmployeeId, session.employeeId),
            ne(shiftSwapRequests.targetEmployeeId, session.employeeId),
          ),
        )
    : null

  // --- thanks redemptions ---
  const thanksCountQuery = canDecideRedemption(session)
    ? c.var.database
        .select({ total: count() })
        .from(thanksRedemptions)
        .where(
          and(
            eq(thanksRedemptions.status, "pending"),
            ne(thanksRedemptions.employeeId, session.employeeId),
          ),
        )
    : null

  // 各クエリを並列実行し、権限がない inbox は 0 を返す。
  // biome-ignore lint: query result typing varies per table
  const extract = async (q: unknown) =>
    q !== null ? ((await (q as Promise<Array<{ total: number }>>)).at(0)?.total ?? 0) : 0

  const [appCount, expCount, leaveCount, shiftCount, thanksCount] = await Promise.all([
    extract(applicationCountQuery),
    extract(expenseCountQuery),
    extract(leaveCountQuery),
    extract(shiftCountQuery),
    extract(thanksCountQuery),
  ])

  return c.json(
    {
      applications: appCount,
      expenses: expCount,
      leaves: leaveCount,
      shifts: shiftCount,
      thanks: thanksCount,
    },
    200,
  )
})
