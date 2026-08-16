import type { AccountId } from "@system/domain/auth/account-id"
import type { SystemWorkflowWriter } from "@system/application/workflow/system-workflow-writer"
import { InvalidSystemWorkflowError } from "@system/domain/workflow/invalid-system-workflow.error"

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
