import type { SystemProposalView } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"

/** 本文と同じProposal snapshotから、判断時に送り返す参照を作る。 */
export function toApplicationDecisionTarget(proposal: SystemProposalView) {
  return {
    proposal_version: proposal.version,
    proposal_digest: proposal.digest,
    task_key: proposal.currentTaskKey ?? proposal.lastTaskKey,
    task_round: proposal.currentTaskRound ?? proposal.lastTaskRound,
  }
}
