import { z } from "zod"
import type { PerformanceReviewContext } from "@/contexts/performance-review/configuration/performance-review-context"
import { performanceReviewRecordKindSchema } from "@/contexts/performance-review/domain/definitions/performance-review-record-kind.definition"
import { performanceReviewSourceTables } from "@/contexts/performance-review/infrastructure/adapters/lib/performance-review-snapshot-query"
import { PerformanceReviewActorReadAdapter } from "@/contexts/performance-review/infrastructure/adapters/performance-review-actor-read.adapter"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"

type Context = PerformanceReviewContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: performanceReviewRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})

/** 停止した評価8台帳を各主キー順に分割し、停止世代も同じ読取で確認する。 */
export class ListFrozenPerformanceReviewRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new PerformanceReviewActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await openSystemRecordSourceFreezes({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "performance-review",
    })
    if (generation instanceof Error) return generation
    const after = request.afterCursor
    const cursor = after
    if (after !== null && !z.uuid().safeParse(after).success)
      return new Error("invalid performance review cursor")
    const source = performanceReviewSourceTables[request.recordKind]
    try {
      const page =
        after === null
          ? this.c.env.DB.prepare(
              `SELECT ${source.key} AS record_id FROM ${source.table} ORDER BY ${source.key} COLLATE BINARY LIMIT ?1`,
            ).bind(request.limit + 1)
          : this.c.env.DB.prepare(
              `SELECT ${source.key} AS record_id FROM ${source.table} WHERE ${source.key} COLLATE BINARY>?1 ORDER BY ${source.key} COLLATE BINARY LIMIT ?2`,
            ).bind(cursor, request.limit + 1)
      const statements = [...generation.assertions, page, ...generation.assertions]
      const reads = await this.c.env.DB.batch<{ record_id: string }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen performance review inventory unavailable")
      const ids = (reads[generation.assertions.length]?.results ?? []).map((row) =>
        String(row.record_id),
      )
      if (new Set(ids).size !== ids.length || ids.some((id) => id.length === 0))
        return new Error("invalid performance review inventory")
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen performance review inventory unavailable", { cause })
    }
  }
}
