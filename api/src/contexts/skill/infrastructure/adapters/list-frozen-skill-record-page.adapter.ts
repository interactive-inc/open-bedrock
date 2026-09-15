import { z } from "zod"
import type { SkillContext } from "@/contexts/skill/configuration/skill-context"
import { SkillActorReadAdapter } from "@/contexts/skill/infrastructure/adapters/skill-actor-read.adapter"
import {
  decodeEmployeeSkillRecordId,
  encodeEmployeeSkillRecordId,
  skillRecordKindSchema,
} from "@/contexts/skill/domain/skill-record-kind"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

type Context = SkillContext
const inputSchema = z.strictObject({
  freezeId: z.uuid(), sourceNamespace: z.string().min(1).max(255).regex(/^\S+$/),
  recordKind: skillRecordKindSchema, afterCursor: z.string().nullable(),
  limit: z.number().int().min(1).max(100),
})

/** 未解除の停止世代から指定したスキル台帳のIDを分割取得し、同じ停止世代を検査する。 */
export class ListFrozenSkillRecordPageAdapter {
  constructor(private readonly c: Context) { Object.freeze(this) }

  async prepare(input: unknown) {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const actor = await new SkillActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    const generation = await new RecordSourceFreezeRepository({ env: this.c.env, assertions: actor.assertions })
      .prepareActiveGeneration({ id: request.freezeId, sourceNamespace: request.sourceNamespace, ownerContext: "skill" })
    if (generation instanceof Error) return generation
    const query = this.query(request.recordKind, request.afterCursor, request.limit + 1)
    if (query instanceof Error) return query
    try {
      const statements = [...generation.assertions, this.c.env.DB.prepare(query.sql).bind(...query.values), ...generation.assertions]
      const reads = await this.c.env.DB.batch<{ record_id?: string; employee_id?: string; skill_code?: string }>(statements)
      if (reads.length !== statements.length || reads.some((read) => !read.success))
        return new Error("frozen skill inventory unavailable")
      const rows = reads[generation.assertions.length]?.results ?? []
      const ids = rows.map((row) => request.recordKind === "employee-skill-record"
        ? encodeEmployeeSkillRecordId(String(row.employee_id), String(row.skill_code))
        : String(row.record_id))
      if (new Set(ids).size !== ids.length || ids.some((id) => id.length === 0))
        return new Error("invalid skill inventory")
      const recordIds = ids.slice(0, request.limit)
      return Object.freeze({
        freezeId: generation.freeze.snapshot.id,
        recordIds: Object.freeze(recordIds),
        nextCursor: ids.length > request.limit ? (recordIds.at(-1) ?? null) : null,
        assertions: generation.assertions,
      })
    } catch (cause) {
      return new Error("frozen skill inventory unavailable", { cause })
    }
  }

  private query(kind: z.infer<typeof skillRecordKindSchema>, cursor: string | null, limit: number) {
    if (kind === "skill-record")
      return { sql: "SELECT code AS record_id FROM skill_definitions WHERE code>?1 ORDER BY code LIMIT ?2", values: [cursor ?? "", limit] }
    const key = cursor === null ? null : decodeEmployeeSkillRecordId(cursor)
    if (cursor !== null && key === null) return new Error("invalid employee skill cursor")
    return {
      sql: `SELECT employee_id,skill_code FROM employee_skills
        WHERE employee_id>?1 OR (employee_id=?1 AND skill_code>?2)
        ORDER BY employee_id,skill_code LIMIT ?3`,
      values: [key?.employeeId ?? "", key?.skillCode ?? "", limit],
    }
  }
}
