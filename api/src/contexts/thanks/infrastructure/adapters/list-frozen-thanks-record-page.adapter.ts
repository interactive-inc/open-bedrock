import { z } from "zod"
import type { ThanksContext } from "@/contexts/thanks/configuration/thanks-context"
import { ThanksActorReadAdapter } from "@/contexts/thanks/infrastructure/adapters/thanks-actor-read.adapter"
import { thanksRecordKindSchema } from "@/contexts/thanks/domain/definitions/thanks-record-kind.definition"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

type Context = ThanksContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: thanksRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})
const tableByKind = {
  "thanks-message-record": "thanks_messages",
  "thanks-point-budget-record": "thanks_point_budgets",
  "thanks-reward-record": "thanks_rewards",
  "thanks-redemption-record": "thanks_redemptions",
} as const

/** 未解除の停止世代から指定したサンクス台帳のIDを分割取得し、同じ停止世代を検査する。 */
export class ListFrozenThanksRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new ThanksActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await new RecordSourceFreezeRepository({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "thanks",
    })
    if (generation instanceof Error) return generation
    const after = request.afterCursor === null ? null : Number(request.afterCursor)
    if (after !== null && (!Number.isSafeInteger(after) || String(after) !== request.afterCursor))
      return new Error("invalid thanks cursor")
    try {
      const page =
        after === null
          ? this.c.env.DB.prepare(
              `SELECT id AS record_id FROM ${tableByKind[request.recordKind]} ORDER BY id LIMIT ?1`,
            ).bind(request.limit + 1)
          : this.c.env.DB.prepare(
              `SELECT id AS record_id FROM ${tableByKind[request.recordKind]} WHERE id>?1 ORDER BY id LIMIT ?2`,
            ).bind(after, request.limit + 1)
      const statements = [...generation.assertions, page, ...generation.assertions]
      const reads = await this.c.env.DB.batch<{ record_id: number }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen thanks inventory unavailable")
      const ids = (reads[generation.assertions.length]?.results ?? []).map((row) =>
        String(row.record_id),
      )
      if (new Set(ids).size !== ids.length || ids.some((id) => id.length === 0))
        return new Error("invalid thanks inventory")
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen thanks inventory unavailable", { cause })
    }
  }
}
