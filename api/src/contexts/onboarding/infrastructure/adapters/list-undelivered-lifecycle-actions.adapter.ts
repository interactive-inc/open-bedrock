import {
  listDueEmploymentLifecycleActions,
  type DueEmploymentLifecycleAction,
} from "@/contexts/company/interface/operations/list-due-employment-lifecycle-actions"

type Context = D1Database
const PAGE_SIZE = 100

/** Companyが返す発効済みの発令から、この業務の台帳に受領記録のないものだけを記録順に集める。 */
export class ListUndeliveredLifecycleActionsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async list(
    window: Readonly<{
      recordedFrom: number
      recordedUntil: number
      observedOn: string
      limit: number
    }>,
  ): Promise<ReadonlyArray<DueEmploymentLifecycleAction> | Error> {
    const undelivered: DueEmploymentLifecycleAction[] = []
    let afterSequence = 0
    while (undelivered.length < window.limit) {
      const page = await listDueEmploymentLifecycleActions({
        database: this.c,
        recordedFrom: window.recordedFrom,
        recordedUntil: window.recordedUntil,
        observedOn: window.observedOn,
        afterSequence,
        limit: PAGE_SIZE,
      })
      if (page instanceof Error) return page
      const last = page.at(-1)
      if (last === undefined) break
      const placeholders = page.map((_, index) => `?${index + 1}`).join(",")
      const delivered = await this.c
        .prepare(
          `SELECT action_id FROM onboarding_lifecycle_deliveries WHERE action_id IN (${placeholders})`,
        )
        .bind(...page.map((action) => action.actionId))
        .all<{ action_id: string }>()
      if (!delivered.success) return new Error("failed to list lifecycle deliveries")
      const deliveredIds = new Set(delivered.results.map((row) => row.action_id))
      for (const action of page) {
        if (!deliveredIds.has(action.actionId) && undelivered.length < window.limit)
          undelivered.push(action)
      }
      if (page.length < PAGE_SIZE) break
      afterSequence = last.sequence
    }
    return undelivered
  }
}
