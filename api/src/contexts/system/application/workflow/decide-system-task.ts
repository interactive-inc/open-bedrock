import type { AccountId } from "@system/domain/auth/account-id"
import type {
  SystemTaskPersistence,
  SystemWorkflowDecisionResult,
  SystemWorkflowWriter,
} from "@system/infrastructure/workflow/system-workflow-writer.repository"
import { HumanAttestation } from "@system/domain/workflow/human-attestation.entity"
import { InvalidSystemWorkflowError } from "@system/domain/workflow/invalid-system-workflow.error"
import type { ProposalDigest } from "@system/domain/workflow/system-case-reference"
import type { SystemCaseId } from "@system/domain/workflow/system-case.entity"

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
  nextTask: SystemTaskPersistence | null
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

    const attestation = HumanAttestation.create({
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
