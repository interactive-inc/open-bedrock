import type { CareerContext } from "@/contexts/career/configuration/career-context"
import { careerRecordKindSchema } from "@/contexts/career/domain/definitions/career-record-kind.definition"
import { CareerActorReadAdapter } from "@/contexts/career/infrastructure/adapters/career-actor-read.adapter"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"
import { z } from "zod"

type Context = CareerContext

const inputSchema = z.strictObject({
  freezeId: z.uuid(),
  sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: careerRecordKindSchema,
  afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})

/** 未解除の停止世代から指定したキャリア台帳のIDを分割取得し、同じ停止世代を検査する。 */
export class ListFrozenCareerRecordPageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new CareerActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await new RecordSourceFreezeRepository({
      env: this.c.env,
      assertions: actor.assertions,
    }).prepareActiveGeneration({
      id: request.freezeId,
      sourceNamespace: request.sourceNamespace,
      ownerContext: "career",
    })
    if (generation instanceof Error) return generation
    const numeric = request.recordKind !== "career-sheet-record"
    const after = numeric
      ? request.afterCursor === null
        ? 0
        : Number(request.afterCursor)
      : (request.afterCursor ?? "")
    if (
      numeric &&
      (!Number.isSafeInteger(after) ||
        Number(after) < 0 ||
        (request.afterCursor !== null && String(after) !== request.afterCursor))
    )
      return new Error("invalid career cursor")
    const [table, column] =
      request.recordKind === "career-posting-record"
        ? ["career_postings", "id"]
        : request.recordKind === "career-application-record"
          ? ["career_applications", "id"]
          : ["career_sheets", "employee_id"]
    try {
      const page = this.c.env.DB.prepare(
        `SELECT ${column} AS record_id FROM ${table} WHERE ${column}>?1 ORDER BY ${column} LIMIT ?2`,
      ).bind(after, request.limit + 1)
      const statements = [...generation.assertions, page, ...generation.assertions]
      const reads = await this.c.env.DB.batch<{ record_id: string | number }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen career inventory unavailable")
      const ids = (reads[generation.assertions.length]?.results ?? []).map((row) =>
        String(row.record_id),
      )
      if (new Set(ids).size !== ids.length || ids.some((id) => id.length === 0))
        return new Error("invalid career inventory")
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen career inventory unavailable", { cause })
    }
  }
}
