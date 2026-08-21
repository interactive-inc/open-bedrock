import type { AccountId } from "@system/domain/values/account-id.schema"
import type {
  SystemWorkflowDecisionResult,
  SystemWorkflowWriter,
} from "@system/infrastructure/workflow/system-d1-workflow-writer.repository"
import type { SystemDecisionTaskBundle } from "@system/domain/values/system-decision-task-bundle.definition"
import { HumanAttestationEntity } from "@system/domain/entities/human-attestation.entity"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import type { ProposalDigest } from "@system/domain/values/system-case-reference.schema"
import type { SystemCaseId } from "@system/domain/values/system-case.schema"

export type DecideSystemTaskCommand = Readonly<{
  caseId: SystemCaseId
  taskKey: string
  round: number
  actorAccountId: AccountId
  representedAccountId: AccountId
  delegationId: string | null
  action: "approve" | "reject" | "return"
  proposalDigest: ProposalDigest
  comment: string | null
  decidedAt: Date
  nextTask: SystemDecisionTaskBundle | null
}>

/** 固定済みdigestへの人間判断を追記し、TaskとCaseを単調に進める。 */
export class DecideSystemTask {
  constructor(private readonly writer: SystemWorkflowWriter) {}

  async run(
    command: DecideSystemTaskCommand,
  ): Promise<SystemWorkflowDecisionResult | InvalidSystemWorkflowError | Error> {
    if (command.action !== "approve" && command.nextTask !== null) {
      return new InvalidSystemWorkflowError("invalid_transition")
    }

    const attestation = HumanAttestationEntity.create({
      id: crypto.randomUUID(),
      caseId: command.caseId,
      taskKey: command.taskKey,
      round: command.round,
      actorAccountId: command.actorAccountId,
      representedAccountId: command.representedAccountId,
      delegationId: command.delegationId,
      action: command.action,
      proposalDigest: command.proposalDigest,
      comment: command.comment,
      decidedAt: command.decidedAt,
    })

    if (attestation instanceof InvalidSystemWorkflowError) return attestation

    return this.writer.decide({
      attestation,
      decidedAt: command.decidedAt,
      nextTask: command.nextTask,
    })
  }
}
