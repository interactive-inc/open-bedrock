import { z } from "zod"
import type { DocumentContext } from "@/contexts/document/configuration/document-context"
import { DocumentActorReadAdapter } from "@/contexts/document/infrastructure/adapters/document-actor-read.adapter"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

type Context = DocumentContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  afterId: z.number().int().nonnegative().safe(),
  limit: z.number().int().min(1).max(100),
})

/** 未解除の停止世代から文書台帳の記録IDを分割取得し、後続の保存でも同じ世代を検査する。 */
export class ListFrozenDocumentRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new DocumentActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await new RecordSourceFreezeRepository({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "document",
    })
    if (generation instanceof Error) return generation
    try {
      const page =
        request.afterId === 0
          ? this.c.env.DB.prepare(
              "SELECT id FROM document_ledger_entries ORDER BY id LIMIT ?1",
            ).bind(request.limit + 1)
          : this.c.env.DB.prepare(
              "SELECT id FROM document_ledger_entries WHERE id>?1 ORDER BY id LIMIT ?2",
            ).bind(request.afterId, request.limit + 1)
      const statements = [...generation.assertions, page, ...generation.assertions]
      const reads = await this.c.env.DB.batch<{ id: number }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen document inventory unavailable")
      const rows = reads[generation.assertions.length]?.results
      const ids = z
        .array(z.strictObject({ id: z.number().int().positive().safe() }))
        .max(request.limit + 1)
        .safeParse(rows)
      if (!ids.success) return ids.error
      const recordIds = ids.data.slice(0, request.limit).map((row) => row.id)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextAfterId: ids.data.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen document inventory unavailable", { cause })
    }
  }
}
