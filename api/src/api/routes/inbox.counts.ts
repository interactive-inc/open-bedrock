import { InternalError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { resolveActiveSystemAccountId } from "@/contexts/company/interface/http/accounts/resolve-active-system-account-id"
import { systemProposalQuery } from "@/api/http/application-requests/lib/system-application-operation"
import { readInboxBusinessCounts } from "@/api/http/inbox/read-inbox-business-counts"

// @authorization authenticated - ログインしていれば誰でも読める。各inboxの件数は権限ごとに0へ潰す
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

  const counts = await readInboxBusinessCounts(c, {
    employeeId: session.employeeId,
    canApproveExpenses: session.hasPermission("expense:approve"),
    canApproveLeaves: session.hasPermission("leave:approve"),
    canApproveShiftSwaps: session.hasPermission("shift_swap:approve"),
    canApproveThanksRedemptions: session.hasPermission("thanks_redemption:approve"),
  })

  return c.json(
    {
      applications: applicationInbox.total,
      expenses: counts.expenses,
      leaves: counts.leaves,
      shifts: counts.shifts,
      thanks: counts.thanks,
    },
    200,
  )
})
