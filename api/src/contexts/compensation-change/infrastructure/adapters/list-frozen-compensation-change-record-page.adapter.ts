import type { CompensationChangeContext } from "@/contexts/compensation-change/configuration/compensation-change-context"
import { compensationChangeRecordKindSchema } from "@/contexts/compensation-change/domain/definitions/compensation-change-record-kind.definition"
import { CompensationChangeActorReadAdapter } from "@/contexts/compensation-change/infrastructure/adapters/compensation-change-actor-read.adapter"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"
import { z } from "zod"

type Context = CompensationChangeContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: compensationChangeRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})

/** 停止世代に属する給与改定IDを安定した順序で分割取得する。 */
export class ListFrozenCompensationChangeRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new CompensationChangeActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await new RecordSourceFreezeRepository({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "compensation-change",
    })
    if (generation instanceof Error) return generation
    const after = request.afterCursor === null ? null : Number(request.afterCursor)
    if (after !== null && (!Number.isSafeInteger(after) || String(after) !== request.afterCursor))
      return new Error("invalid compensation change cursor")
    try {
      const page =
        after === null
          ? this.c.env.DB.prepare(
              "SELECT id AS record_id FROM salary_revisions ORDER BY id LIMIT ?1",
            ).bind(request.limit + 1)
          : this.c.env.DB.prepare(
              "SELECT id AS record_id FROM salary_revisions WHERE id>?1 ORDER BY id LIMIT ?2",
            ).bind(after, request.limit + 1)
      const statements = [...generation.assertions, page, ...generation.assertions]
      const reads = await this.c.env.DB.batch<{ record_id: number }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen compensation change inventory unavailable")
      const ids = (reads[generation.assertions.length]?.results ?? []).map((row) =>
        String(row.record_id),
      )
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen compensation change inventory unavailable", { cause })
    }
  }
}
