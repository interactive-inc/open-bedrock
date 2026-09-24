import { z } from "zod"
import type { RecruitmentContext } from "@/contexts/recruitment/configuration/recruitment-context"
import { RecruitmentActorReadAdapter } from "@/contexts/recruitment/infrastructure/adapters/recruitment-actor-read.adapter"
import { recruitmentRecordKindSchema } from "@/contexts/recruitment/domain/definitions/recruitment-record-kind.definition"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"

type Context = RecruitmentContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: recruitmentRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})
const tableByKind = {
  "recruitment-position-record": "job_openings",
  "recruitment-candidate-record": "recruitment_candidates",
} as const

/** 未解除の停止世代から指定した採用台帳のIDを分割取得し、同じ停止世代を検査する。 */
export class ListFrozenRecruitmentRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new RecruitmentActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await openSystemRecordSourceFreezes({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "recruitment",
    })
    if (generation instanceof Error) return generation
    const after = request.afterCursor === null ? null : Number(request.afterCursor)
    if (after !== null && (!Number.isSafeInteger(after) || String(after) !== request.afterCursor))
      return new Error("invalid recruitment cursor")
    try {
      const table = tableByKind[request.recordKind]
      const page =
        after === null
          ? this.c.env.DB.prepare(`SELECT id AS record_id FROM ${table} ORDER BY id LIMIT ?1`).bind(
              request.limit + 1,
            )
          : this.c.env.DB.prepare(
              `SELECT id AS record_id FROM ${table} WHERE id>?1 ORDER BY id LIMIT ?2`,
            ).bind(after, request.limit + 1)
      const statements = [...generation.assertions, page, ...generation.assertions]
      const reads = await this.c.env.DB.batch<{ record_id: number }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen recruitment inventory unavailable")
      const ids = (reads[generation.assertions.length]?.results ?? []).map((row) =>
        String(row.record_id),
      )
      if (new Set(ids).size !== ids.length || ids.some((id) => id.length === 0))
        return new Error("invalid recruitment inventory")
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen recruitment inventory unavailable", { cause })
    }
  }
}
