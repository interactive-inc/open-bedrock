import type { SystemClockContext, SystemD1Context } from "@system/configuration/system-context"
import type { RecordPreservationSubmissionContext } from "@system/configuration/record-preservation-submission-context"
import type { SystemProposalView } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import type { ApproveSystemTaskCommand } from "@system/application/workflow/approve-system-task"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/** 人間の判断資格は外部で解決し、Systemは固定した対象に対する判断を保存する。 */
export type RecordPreservationDecisionContext = SystemD1Context &
  SystemClockContext &
  Readonly<{
    source: Pick<
      RecordPreservationSubmissionContext["source"],
      "ownerContext" | "recordKind" | "recordId" | "sourceNamespace"
    >
    prepareDecision: (
      input: Readonly<{
        proposal: SystemProposalView
        decisionTarget: Readonly<{
          proposalVersion: number
          proposalDigest: string
          taskKey: string
          taskRound: number
        }>
        actorAccountId: AccountId
        action: "approve" | "reject"
        decidedAt: Date
      }>,
    ) => Promise<
      | (Omit<ApproveSystemTaskCommand, "comment" | "decidedAt"> &
          Readonly<{
            action: "approve" | "reject" | "return"
            guards: ReadonlyArray<D1PreparedStatement>
          }>)
      | Error
    >
  }>
