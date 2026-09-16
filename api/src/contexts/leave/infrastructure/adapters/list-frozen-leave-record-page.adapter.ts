import { z } from "zod"
import type { LeaveContext } from "@/contexts/leave/configuration/leave-context"
import { LeaveActorReadAdapter } from "@/contexts/leave/infrastructure/adapters/leave-actor-read.adapter"
import { leaveRecordKindSchema } from "@/contexts/leave/domain/definitions/leave-record-kind.definition"
import { leaveInventoryQuery } from "@/contexts/leave/infrastructure/adapters/lib/leave-inventory-query"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

type Context = LeaveContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: leaveRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})

/** 休暇4台帳を主キー順に分割列挙し、全ページを同じ書込み停止世代に固定する。 */
export class ListFrozenLeaveRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new LeaveActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await new RecordSourceFreezeRepository({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "leave",
    })
    if (generation instanceof Error) return generation
    const query = leaveInventoryQuery(request.recordKind, request.afterCursor, request.limit)
    if (query instanceof Error) return query
    try {
      const statement = this.c.env.DB.prepare(query.sql).bind(...query.values)
      const statements = [...generation.assertions, statement, ...generation.assertions]
      const reads = await this.c.env.DB.batch<Record<string, unknown>>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen leave inventory unavailable")
      const ids = (reads[generation.assertions.length]?.results ?? []).map(query.recordId)
      if (new Set(ids).size !== ids.length || ids.some((id) => id.length === 0))
        return new Error("invalid leave inventory")
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen leave inventory unavailable", { cause })
    }
  }
}
