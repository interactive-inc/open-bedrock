import { z } from "zod"
import type { RoomContext } from "@/contexts/room/configuration/room-context"
import { RoomActorReadAdapter } from "@/contexts/room/infrastructure/adapters/room-actor-read.adapter"
import { roomRecordKindSchema } from "@/contexts/room/domain/definitions/room-record-kind.definition"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

type Context = RoomContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: roomRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})
const tableByKind = {
  "room-record": "rooms",
  "room-reservation-record": "room_reservations",
} as const

/** 未解除の停止世代から指定した会議室台帳のIDを分割取得し、同じ停止世代を検査する。 */
export class ListFrozenRoomRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new RoomActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await new RecordSourceFreezeRepository({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "room",
    })
    if (generation instanceof Error) return generation
    const after = request.afterCursor
    if (after !== null) {
      if (request.recordKind === "room-record") {
        const number = Number(after)
        if (!Number.isSafeInteger(number) || number <= 0 || String(number) !== after)
          return new Error("invalid room cursor")
      } else if (after.length === 0 || after.length > 1000) {
        return new Error("invalid room cursor")
      }
    }
    try {
      const table = tableByKind[request.recordKind]
      const page =
        after === null
          ? this.c.env.DB.prepare(`SELECT id AS record_id FROM ${table} ORDER BY id LIMIT ?1`).bind(
              request.limit + 1,
            )
          : this.c.env.DB.prepare(
              `SELECT id AS record_id FROM ${table} WHERE id>?1 ORDER BY id LIMIT ?2`,
            ).bind(request.recordKind === "room-record" ? Number(after) : after, request.limit + 1)
      const statements = [...generation.assertions, page, ...generation.assertions]
      const reads = await this.c.env.DB.batch<{ record_id: number | string }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen room inventory unavailable")
      const ids = (reads[generation.assertions.length]?.results ?? []).map((row) =>
        String(row.record_id),
      )
      if (new Set(ids).size !== ids.length || ids.some((id) => id.length === 0))
        return new Error("invalid room inventory")
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen room inventory unavailable", { cause })
    }
  }
}
