import type { Context } from "@/env"
import { OneOnOneRepository } from "@/infrastructure/oneonone/one-on-one-repository"

export type Command = {
  oneOnOneId: string
  managerId: number
}

export type OneOnOneNotFound = { reason: "one_on_one_not_found" }

export type NotManager = { reason: "not_manager" }

export type Deleted = { reason: "deleted" }

/**
 * 1on1 の記録を削除する。記録した上長以外の削除を拒否する。
 */
export class DeleteOneOnOne {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | OneOnOneNotFound | NotManager | Error> {
    const oneOnOneRepository = new OneOnOneRepository(this.c)

    const current = await oneOnOneRepository.findById(command.oneOnOneId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "one_on_one_not_found" }
    }

    if (current.managerId !== command.managerId) {
      return { reason: "not_manager" }
    }

    const deleted = await oneOnOneRepository.delete(command.oneOnOneId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }
}
