import { z } from "zod"
import type { MeetingContext } from "@/contexts/meeting/configuration/meeting-context"
import { MeetingActorReadAdapter } from "@/contexts/meeting/infrastructure/adapters/meeting-actor-read.adapter"
import { meetingRecordKindSchema } from "@/contexts/meeting/domain/definitions/meeting-record-kind.definition"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

type Context = MeetingContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: meetingRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})
const tableByKind = {
  "meeting-record": "meetings",
  "meeting-minutes-record": "meeting_minutes_records",
  "meeting-decision-record": "decision_records",
} as const

/** 未解除の停止世代から指定した会議台帳のIDを分割取得し、同じ停止世代を検査する。 */
export class ListFrozenMeetingRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new MeetingActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await new RecordSourceFreezeRepository({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "meeting",
    })
    if (generation instanceof Error) return generation
    const after = request.afterCursor === null ? null : Number(request.afterCursor)
    if (
      after !== null &&
      (!Number.isSafeInteger(after) || after <= 0 || String(after) !== request.afterCursor)
    )
      return new Error("invalid meeting cursor")
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
        return new Error("frozen meeting inventory unavailable")
      const ids = (reads[generation.assertions.length]?.results ?? []).map((row) =>
        String(row.record_id),
      )
      if (new Set(ids).size !== ids.length || ids.some((id) => id.length === 0))
        return new Error("invalid meeting inventory")
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen meeting inventory unavailable", { cause })
    }
  }
}
