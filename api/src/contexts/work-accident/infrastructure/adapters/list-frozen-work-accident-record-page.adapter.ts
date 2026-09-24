import { z } from "zod"
import type { WorkAccidentContext } from "@/contexts/work-accident/configuration/work-accident-context"
import { WorkAccidentActorReadAdapter } from "@/contexts/work-accident/infrastructure/adapters/work-accident-actor-read.adapter"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"

type Context = WorkAccidentContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  afterId: z.number().int().safe().nullable(),
  limit: z.number().int().min(1).max(100),
})

/** 未解除の停止世代から労災・事故記録IDを分割取得し、後続の保存でも同じ世代を検査する。 */
export class ListFrozenWorkAccidentRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new WorkAccidentActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await openSystemRecordSourceFreezes({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "work-accident",
    })
    if (generation instanceof Error) return generation
    try {
      const page =
        request.afterId === null
          ? this.c.env.DB.prepare("SELECT id FROM work_accidents ORDER BY id LIMIT ?1").bind(
              request.limit + 1,
            )
          : this.c.env.DB.prepare(
              "SELECT id FROM work_accidents WHERE id>?1 ORDER BY id LIMIT ?2",
            ).bind(request.afterId, request.limit + 1)
      const statements = [...generation.assertions, page, ...generation.assertions]
      const reads = await this.c.env.DB.batch<{ id: number }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen work-accident inventory unavailable")
      const rows = reads[generation.assertions.length]?.results
      const ids = z
        .array(z.strictObject({ id: z.number().int().safe() }))
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
      return new Error("frozen work-accident inventory unavailable", { cause })
    }
  }
}
