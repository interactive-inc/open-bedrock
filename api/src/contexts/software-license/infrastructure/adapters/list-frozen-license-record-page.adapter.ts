import { z } from "zod"
import type { SoftwareLicenseContext } from "@/contexts/software-license/configuration/software-license-context"
import { LicenseActorReadAdapter } from "@/contexts/software-license/infrastructure/adapters/license-actor-read.adapter"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"

type Context = SoftwareLicenseContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  afterId: z.uuid().nullable(),
  limit: z.number().int().min(1).max(100),
})

/** 未解除の停止世代からサービス台帳IDを分割取得し、後続の保存でも同じ世代を検査する。 */
export class ListFrozenLicenseRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new LicenseActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await openSystemRecordSourceFreezes({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "software-license",
    })
    if (generation instanceof Error) return generation
    try {
      const page =
        request.afterId === null
          ? this.c.env.DB.prepare(
              "SELECT id FROM software_licenses ORDER BY id COLLATE BINARY LIMIT ?1",
            ).bind(request.limit + 1)
          : this.c.env.DB.prepare(
              "SELECT id FROM software_licenses WHERE id COLLATE BINARY>?1 ORDER BY id COLLATE BINARY LIMIT ?2",
            ).bind(request.afterId, request.limit + 1)
      const statements = [...generation.assertions, page, ...generation.assertions]
      const reads = await this.c.env.DB.batch<{ id: string }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen software-license inventory unavailable")
      const rows = reads[generation.assertions.length]?.results
      const ids = z
        .array(z.strictObject({ id: z.uuid() }))
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
      return new Error("frozen software-license inventory unavailable", { cause })
    }
  }
}
