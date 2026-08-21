import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemWorkflowWriter } from "@system/infrastructure/workflow/system-d1-workflow-writer.repository"
import { InvalidSystemWorkflowError } from "@system/domain/errors"

/** 提案本文と判断履歴を消さず、現在の未完了Caseだけを取り消す。 */
export class CancelSystemProcedure {
  constructor(private readonly writer: SystemWorkflowWriter) {}

  async run(
    input: Readonly<{
      number: number
      createdByAccountId: AccountId
      cancelledAt: Date
    }>,
  ): Promise<true | "not_found" | "not_pending" | InvalidSystemWorkflowError | Error> {
    if (
      !Number.isSafeInteger(input.number) ||
      input.number <= 0 ||
      !Number.isFinite(input.cancelledAt.getTime())
    ) {
      return new InvalidSystemWorkflowError("invalid_shape")
    }

    return this.writer.cancel(input)
  }
}
