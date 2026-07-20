import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import {
  applications,
  applicationTemplates,
  expenses,
  leaveRequests,
  shiftSwapRequests,
  thanksRedemptions,
} from "@/schema"
import { and, count, eq, ne } from "drizzle-orm"
import { resolveApplicationInboxCondition } from "@/lib/application/resolve-application-inbox-condition"

/**
 * GET /inbox/counts — 受信箱ごとの未処理件数を一括取得する。
 * ユーザーの権限に応じて各カウントを返す（権限がない inbox は 0）。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  // --- applications ---
  // 一覧と同じ案件候補者・委任・組織スコープ条件を使い、件数から非公開案件を推測させない。
  const pendingWithRole = await resolveApplicationInboxCondition({
    c,
    session,
    now: c.env.NOW ?? new Date().toISOString(),
  })
  if (pendingWithRole instanceof Error) {
    throw new InternalError("failed to resolve application inbox scope")
  }

  const applicationCountQuery = c.var.database
    .select({ total: count() })
    .from(applications)
    .innerJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
    .where(pendingWithRole)

  // --- expenses ---
  const expenseCountQuery = session.hasPermission("expense:approve")
    ? c.var.database.select({ total: count() }).from(expenses).where(eq(expenses.status, "pending"))
    : null

  // --- leave requests ---
  const leaveCountQuery = session.hasPermission("leave:approve")
    ? c.var.database
        .select({ total: count() })
        .from(leaveRequests)
        .where(eq(leaveRequests.status, "pending"))
    : null

  // --- shift swap requests ---
  const shiftCountQuery = session.hasPermission("shift_swap:approve")
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
  const thanksCountQuery = session.hasPermission("thanks_redemption:approve")
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
