import type { Context } from "@/env"
import { OneOnOneRepository } from "@/contexts/one-on-one/infrastructure/oneonone/one-on-one-repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  oneOnOneId: string
  managerId: number
}

export type Deleted = { reason: "deleted" }

/**
 * 1on1 の記録を削除する。記録した上長以外の削除を拒否する。
 */
export class DeleteOneOnOne {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
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

    const deleted = await oneOnOneRepository.delete(command.oneOnOneId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete one-on-one", { cause: deleted })
    }

    if (deleted === null) {
      return new NotFoundError("one-on-one not found", "one_on_one_not_found")
    }

    return { reason: "deleted" }
  }
}
