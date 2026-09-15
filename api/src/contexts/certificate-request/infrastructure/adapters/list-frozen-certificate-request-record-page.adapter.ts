import { z } from "zod"
import type { CertificateRequestContext } from "@/contexts/certificate-request/configuration/certificate-request-context"
import { CertificateRequestActorReadAdapter } from "@/contexts/certificate-request/infrastructure/adapters/certificate-request-actor-read.adapter"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

type Context = CertificateRequestContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  afterId: z.uuid().nullable(),
  limit: z.number().int().min(1).max(100),
})

/** 未解除の停止世代からcertificate request記録IDを分割取得し、後続の保存でも同じ世代を検査する。 */
export class ListFrozenCertificateRequestRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new CertificateRequestActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await new RecordSourceFreezeRepository({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "certificate-request",
    })
    if (generation instanceof Error) return generation
    try {
      const statements = [
        ...generation.assertions,
        this.c.env.DB.prepare(
          "SELECT id FROM certificate_requests WHERE (?1 IS NULL OR id COLLATE BINARY>?1) ORDER BY id COLLATE BINARY LIMIT ?2",
        ).bind(request.afterId, request.limit + 1),
        ...generation.assertions,
      ]
      const reads = await this.c.env.DB.batch<{ id: string }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen certificate-request inventory unavailable")
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
      return new Error("frozen certificate-request inventory unavailable", { cause })
    }
  }
}
