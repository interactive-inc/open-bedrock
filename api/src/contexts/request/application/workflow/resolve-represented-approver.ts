import type { Context } from "@/env"
import { approvalDelegations } from "@/contexts/request/infrastructure/schema/request"
import { and, asc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm"
import { filterLiveWorkflowAccounts } from "@/contexts/request/application/workflow/filter-live-workflow-accounts"
import type { AccountId } from "@system/domain/auth/account-id"

/**
 * 操作者が候補本人か、有効な委任を受けているかを判定し、代表する承認者を返す。
 * 本人が active 候補なら本人、そうでなければ委任元候補、いずれも該当しなければ null
 */
export async function resolveRepresentedApprover(props: {
  c: Context
  actorEmployeeId: number
  actorAccountId: AccountId
  candidateAccounts: ReadonlyArray<{ employeeId: number; accountId: AccountId }>
  templateCode: string
  now: string
  allowDelegation: boolean
  excludedEmployeeIds?: ReadonlySet<number>
}): Promise<{ employeeId: number; delegationId: number | null } | null | Error> {
  const activeCandidateAccounts = await loadActiveCandidateAccounts(props)
  if (activeCandidateAccounts instanceof Error) return activeCandidateAccounts

  if (
    activeCandidateAccounts.some(
      (candidate) =>
        candidate.employeeId === props.actorEmployeeId &&
        candidate.accountId === props.actorAccountId &&
        props.excludedEmployeeIds?.has(candidate.employeeId) !== true,
    )
  ) {
    return { employeeId: props.actorEmployeeId, delegationId: null }
  }

  const candidateEmployeeIds = [
    ...new Set(activeCandidateAccounts.map((candidate) => candidate.employeeId)),
  ]

  if (props.allowDelegation === false || candidateEmployeeIds.length === 0) return null

  try {
    const delegations = await props.c.var.database
      .select({
        id: approvalDelegations.id,
        delegatorEmployeeId: approvalDelegations.delegatorEmployeeId,
      })
      .from(approvalDelegations)
      .where(
        and(
          eq(approvalDelegations.delegateEmployeeId, props.actorEmployeeId),
          inArray(approvalDelegations.delegatorEmployeeId, candidateEmployeeIds),
          lte(approvalDelegations.startsAt, props.now),
          gt(approvalDelegations.endsAt, props.now),
          isNull(approvalDelegations.cancelledAt),
          or(
            eq(approvalDelegations.templateCode, props.templateCode),
            isNull(approvalDelegations.templateCode),
          ),
        ),
      )
      .orderBy(asc(approvalDelegations.delegatorEmployeeId), asc(approvalDelegations.id))

    const delegation = delegations.find(
      (candidate) => props.excludedEmployeeIds?.has(candidate.delegatorEmployeeId) !== true,
    )

    return delegation === undefined
      ? null
      : { employeeId: delegation.delegatorEmployeeId, delegationId: delegation.id }
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve approval delegation")
  }
}

async function loadActiveCandidateAccounts(props: {
  c: Context
  candidateAccounts: ReadonlyArray<{ employeeId: number; accountId: AccountId }>
}): Promise<ReadonlyArray<{ employeeId: number; accountId: AccountId }> | Error> {
  return filterLiveWorkflowAccounts(props.c, props.candidateAccounts)
}
