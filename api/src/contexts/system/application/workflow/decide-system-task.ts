import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type {
  SystemWorkflowDecisionResult,
  SystemWorkflowWriter,
} from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import type { SystemDecisionTaskBundle } from "@system/domain/definitions/workflow/system-decision-task-bundle.definition"
import { HumanAttestationEntity } from "@system/domain/entities/human-attestation.entity"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import type { ProposalDigest } from "@system/domain/schemas/workflow/system-case-reference.schema"
import type { SystemCaseId } from "@system/domain/schemas/workflow/system-case.schema"

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
type DecideSystemTaskContext = SystemWorkflowWriter
type Context = DecideSystemTaskContext

/** 固定済みdigestへの人間判断を追記し、TaskとCaseを単調に進める。 */
export class DecideSystemTask {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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

    return this.c.decide({
      attestation,
      decidedAt: command.decidedAt,
      nextTask: command.nextTask,
    })
  }
}
