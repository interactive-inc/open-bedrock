import type { OneOnOne } from "@/domain/oneonone/one-on-one"
import type { Context } from "@/env"
import { OneOnOneRepository } from "@/infrastructure/oneonone/one-on-one-repository"

export type Command = {
  oneOnOneId: string
  managerId: number
  topics: string | null
  managerNote: string | null
  nextAction: string | null
}

export type OneOnOneNotFound = { reason: "one_on_one_not_found" }

export type NotManager = { reason: "not_manager" }

/**
 * 1on1 の記録内容を変更する。記録した上長以外の変更を拒否する。
 */
export class UpdateOneOnOne {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<OneOnOne | OneOnOneNotFound | NotManager | Error> {
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

    const updated = current.withRecord({
      topics: command.topics,
      managerNote: command.managerNote,
      nextAction: command.nextAction,
    })

    const result = await oneOnOneRepository.update(updated)

    if (result === null) {
      return { reason: "one_on_one_not_found" as const }
    }

    return result
  }
}
