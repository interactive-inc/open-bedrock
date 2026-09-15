import { z } from "zod"
import type { CertificationContext } from "@/contexts/certification/configuration/certification-context"
import { CertificationActorReadAdapter } from "@/contexts/certification/infrastructure/adapters/certification-actor-read.adapter"
import { certificationRecordKindSchema } from "@/contexts/certification/domain/certification-record-kind"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

type Context = CertificationContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(), sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: certificationRecordKindSchema, afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})

/** 未解除の停止世代から指定した資格台帳のIDを分割取得し、同じ停止世代を検査する。 */
export class ListFrozenCertificationRecordPageAdapter {
  constructor(private readonly c: Context) { Object.freeze(this) }

  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new CertificationActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await new RecordSourceFreezeRepository({ env: this.c.env, assertions: actor.assertions })
      .prepareActiveGeneration({ id: request.freezeId, sourceNamespace: request.sourceNamespace, ownerContext: "certification" })
    if (generation instanceof Error) return generation
    const after = request.afterCursor === null ? 0 : Number(request.afterCursor)
    if (!Number.isSafeInteger(after) || after < 0 || (request.afterCursor !== null && String(after) !== request.afterCursor))
      return new Error("invalid certification cursor")
    const table = request.recordKind === "certification-record" ? "certification_definitions" : "employee_certifications"
    try {
      const page = this.c.env.DB.prepare(`SELECT id AS record_id FROM ${table} WHERE id>?1 ORDER BY id LIMIT ?2`)
        .bind(after, request.limit + 1)
      const statements = [...generation.assertions, page, ...generation.assertions]
      const reads = await this.c.env.DB.batch<{ record_id: number }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen certification inventory unavailable")
      const ids = (reads[generation.assertions.length]?.results ?? []).map((row) => String(row.record_id))
      if (new Set(ids).size !== ids.length || ids.some((id) => id.length === 0))
        return new Error("invalid certification inventory")
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen certification inventory unavailable", { cause })
    }
  }
}
