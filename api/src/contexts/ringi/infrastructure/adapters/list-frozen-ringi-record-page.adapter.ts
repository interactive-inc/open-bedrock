import { z } from "zod"
import type { RingiContext } from "@/contexts/ringi/configuration/ringi-context"
import {
  decodeRingiProcedureBindingRecordId,
  encodeRingiProcedureBindingRecordId,
  ringiRecordKindSchema,
} from "@/contexts/ringi/domain/definitions/ringi-record-kind.definition"
import { RingiActorReadAdapter } from "@/contexts/ringi/infrastructure/adapters/ringi-actor-read.adapter"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"

type Context = RingiContext

const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: ringiRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})

/** 停止世代の起案IDまたは案件キーを主キー順に分割し、停止状態も同時に検査する。 */
export class ListFrozenRingiRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new RingiActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await openSystemRecordSourceFreezes({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "ringi",
    })
    if (generation instanceof Error) return generation
    const requests = request.recordKind === "ringi-request-record"
    const after = request.afterCursor
    const requestCursor = requests && after !== null ? after : null
    const bindingCursor =
      !requests && after !== null ? decodeRingiProcedureBindingRecordId(after) : null
    if (
      after !== null &&
      (requests ? !z.uuid().safeParse(requestCursor).success : bindingCursor === null)
    )
      return new Error("invalid ringi cursor")
    try {
      const table = requests ? "ringi_requests" : "ringi_procedure_bindings"
      const column = requests ? "id" : "request_key"
      const page =
        after === null
          ? this.c.env.DB.prepare(
              `SELECT ${column} AS record_id FROM ${table} ORDER BY ${column} COLLATE BINARY LIMIT ?1`,
            ).bind(request.limit + 1)
          : this.c.env.DB.prepare(
              `SELECT ${column} AS record_id FROM ${table} WHERE ${column} COLLATE BINARY>?1 ORDER BY ${column} COLLATE BINARY LIMIT ?2`,
            ).bind(requests ? requestCursor : bindingCursor, request.limit + 1)
      const statements = [...generation.assertions, page, ...generation.assertions]
      const reads = await this.c.env.DB.batch<{ record_id: string }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen ringi inventory unavailable")
      const ids = (reads[generation.assertions.length]?.results ?? []).map((row) =>
        requests
          ? String(row.record_id)
          : encodeRingiProcedureBindingRecordId(String(row.record_id)),
      )
      if (new Set(ids).size !== ids.length || ids.some((id) => id.length === 0))
        return new Error("invalid ringi inventory")
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen ringi inventory unavailable", { cause })
    }
  }
}
