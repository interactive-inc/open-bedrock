import { InternalError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { resolveActiveSystemAccountId } from "@/contexts/company/application/iam/to-system-account-id"
import { systemProposalQuery } from "@/api/routes/application-requests/lib/system-application-operation"
import { expenses, leaveRequests, shiftSwapRequests, thanksRedemptions } from "@/schema"
import { and, count, eq, ne } from "drizzle-orm"

// @authorization permission - 権限キーで判定する
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
  const actorAccountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (actorAccountId instanceof Error) {
    throw new InternalError("failed to resolve canonical workflow actor")
  }
  const applicationInbox = await systemProposalQuery(c).list({
    creatorAccountIds: null,
    actorAccountId,
    statuses: ["pending"],
    procedureKey: null,
    createdFrom: null,
    createdTo: null,
    includeCancelled: false,
    sort: "created_at_desc",
    limit: 1,
    offset: 0,
    at: new Date(c.env.NOW ?? Date.now()),
  })
  if (applicationInbox instanceof Error) {
    throw new InternalError("failed to resolve application inbox scope")
  }

  const expenseCountQuery = session.hasPermission("expense:approve")
    ? c.var.database.select({ total: count() }).from(expenses).where(eq(expenses.status, "pending"))
    : null

  const leaveCountQuery = session.hasPermission("leave:approve")
    ? c.var.database
        .select({ total: count() })
        .from(leaveRequests)
        .where(eq(leaveRequests.status, "pending"))
    : null

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

  // Drizzle の query builder は table ごとに異なる PromiseLike 型になる。
  const extract = async (query: unknown): Promise<number> =>
    query === null ? 0 : ((await (query as Promise<Array<{ total: number }>>)).at(0)?.total ?? 0)

  const [expenseCount, leaveCount, shiftCount, thanksCount] = await Promise.all([
    extract(expenseCountQuery),
    extract(leaveCountQuery),
    extract(shiftCountQuery),
    extract(thanksCountQuery),
  ])

  return c.json(
    {
      applications: applicationInbox.total,
      expenses: expenseCount,
      leaves: leaveCount,
      shifts: shiftCount,
      thanks: thanksCount,
    },
    200,
  )
})
