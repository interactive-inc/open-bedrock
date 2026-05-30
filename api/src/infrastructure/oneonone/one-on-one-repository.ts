import type { OneOnOne } from "@/domain/oneonone/one-on-one"
import type { Context } from "@/env"
import { oneOnOnes } from "@/schema"

export class OneOnOneRepository {
  constructor(private readonly c: Context) {}

  async save(oneOnOne: OneOnOne): Promise<OneOnOne | Error> {
    try {
      await this.c.var.database.insert(oneOnOnes).values({
        id: oneOnOne.id,
        memberId: oneOnOne.memberId,
        managerId: oneOnOne.managerId,
        heldAt: oneOnOne.heldAt,
        topics: oneOnOne.topics,
        managerNote: oneOnOne.managerNote,
        nextAction: oneOnOne.nextAction,
      })

      return oneOnOne
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save one_on_one")
    }
  }
}
