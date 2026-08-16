import type { AccountId } from "@system/domain/auth/account-id"
import type { SystemProcedureRepository } from "@system/application/workflow/system-procedure-repository"
import { InvalidSystemProposalError } from "@system/domain/workflow/invalid-system-proposal.error"
import { ProcedureDefinition } from "@system/domain/workflow/procedure-definition.entity"

export type PublishSystemProcedureCommand = Readonly<{
  key: string
  expectedRevision: number
  title: string
  category: string
  description: string | null
  inputSchema: unknown
  decisionPolicy: unknown
  completionOperationKey: string | null
  createdByAccountId: AccountId
  createdAt: Date
}>

/** 楽観lockを使い、手続の新しい変更不能版だけを公開する。 */
export class PublishSystemProcedure {
  constructor(private readonly repository: SystemProcedureRepository) {}

  async run(
    command: PublishSystemProcedureCommand,
  ): Promise<ProcedureDefinition | "revision_conflict" | InvalidSystemProposalError | Error> {
    if (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0) {
      return new InvalidSystemProposalError("invalid_shape")
    }
    const definition = ProcedureDefinition.create({
      key: command.key,
      revision: command.expectedRevision + 1,
      title: command.title,
      category: command.category,
      description: command.description,
      inputSchema: command.inputSchema,
      decisionPolicy: command.decisionPolicy,
      completionOperationKey: command.completionOperationKey,
      createdByAccountId: command.createdByAccountId,
      createdAt: command.createdAt,
    })

    if (definition instanceof InvalidSystemProposalError) return definition
    const persisted = await this.repository.publish(definition, command.expectedRevision)

    return persisted === true ? definition : persisted
  }
}
