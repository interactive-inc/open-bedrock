import type { OneOnOne } from "@/domain/oneonone/one-on-one.entity"
import type { Context } from "@/env"
import { OneOnOneRepository } from "@/infrastructure/oneonone/one-on-one-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  oneOnOneId: string
  managerId: number
  topics: string | null
  managerNote: string | null
  nextAction: string | null
}

/**
 * 1on1 の記録内容を変更する。記録した上長以外の変更を拒否する。
 */
export class UpdateOneOnOne {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OneOnOne | ApplicationError> {
    const oneOnOneRepository = new OneOnOneRepository(this.c)

    const current = await oneOnOneRepository.findById(command.oneOnOneId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find one-on-one", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("one-on-one not found", "one_on_one_not_found")
    }

    if (current.managerId !== command.managerId) {
      return new ForbiddenError("not the recording manager", "not_manager")
    }

    const updated = current.withRecord({
      topics: command.topics,
      managerNote: command.managerNote,
      nextAction: command.nextAction,
    })

    const result = await oneOnOneRepository.update(updated)

    if (result instanceof Error) {
      return new UnexpectedError("failed to update one-on-one", { cause: result })
    }

    if (result === null) {
      return new NotFoundError("one-on-one not found", "one_on_one_not_found")
    }

    return result
  }
}
