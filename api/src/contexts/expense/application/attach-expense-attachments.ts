import { LinkAttachments } from "@system/application/attachments/link-attachments"
import type { Context } from "@/env"
import { expenseAttachments } from "@/contexts/expense/infrastructure/schema/expense"
import { ApplicationError, UnexpectedError } from "@/lib/errors"

export type Command = Readonly<{
  expenseId: number
  attachmentIds: ReadonlyArray<string>
  ownerAccountId: string
  now: Date
}>

/**
 * 経費へ添付を紐づける。添付の所有と状態の判定は System の port が行い、
 * 「どの経費に属するか」だけを経費 context が持つ。
 */
export class AttachExpenseAttachments {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<void | ApplicationError> {
    if (command.attachmentIds.length === 0) return undefined

    const linked = await new LinkAttachments(this.c).run({
      attachmentIds: command.attachmentIds,
      ownerAccountId: command.ownerAccountId,
      now: command.now,
    })

    if (linked instanceof ApplicationError) return linked

    if (linked instanceof Error) {
      return new UnexpectedError("failed to link attachments", { cause: linked })
    }

    try {
      await this.c.var.database.insert(expenseAttachments).values(
        command.attachmentIds.map((attachmentId) => ({
          expenseId: command.expenseId,
          attachmentId,
          createdAt: command.now.toISOString(),
        })),
      )

      return undefined
    } catch (error) {
      return new UnexpectedError("failed to attach expense attachments", { cause: error })
    }
  }
}
