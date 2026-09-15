import type { SkillContext } from "@/contexts/skill/configuration/skill-context"
import { SkillActorReadAdapter } from "@/contexts/skill/infrastructure/adapters/skill-actor-read.adapter"
import { SkillError } from "@/contexts/skill/domain/errors"
import {
  decodeEmployeeSkillRecordId,
  skillRecordKindSchema,
  type SkillRecordKind,
} from "@/contexts/skill/domain/skill-record-kind"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"

type Context = SkillContext
type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string | number> }>

function snapshotQuery(recordKind: SkillRecordKind, recordId: string): SnapshotQuery | Error {
  if (recordKind === "skill-record") {
    if (!z.string().trim().min(1).max(255).safeParse(recordId).success)
      return new Error("invalid skill record id")
    return {
      sql: `SELECT json_object('format','skill-record','version',1,'skill',json_object(
        'code',code,'name',name,'category',category))
        AS snapshot_json FROM skill_definitions WHERE code=?1`,
      values: [recordId],
    }
  }
  const key = decodeEmployeeSkillRecordId(recordId)
  if (key === null) return new Error("invalid employee skill record id")
  return {
    sql: `SELECT json_object('format','employee-skill-record','version',1,'employeeSkill',json_object(
      'employee_id',employee_id,'skill_code',skill_code,'level',level,'years',years,'note',note))
      AS snapshot_json FROM employee_skills WHERE employee_id=?1 AND skill_code=?2`,
    values: [key.employeeId, key.skillCode],
  }
}

/** 保全資格のある主体へスキル2台帳の原記録を返し、保存直前にも同じ内容を検査する。 */
export class CaptureSkillRecordAdapter {
  constructor(private readonly c: Context) { Object.freeze(this) }

  async prepare(input: Readonly<{ recordKind: SkillRecordKind; recordId: string; sourceNamespace: string }>) {
    const kind = skillRecordKindSchema.safeParse(input.recordKind)
    if (!kind.success) return new SkillError("forbidden", "invalid source record")
    const query = snapshotQuery(kind.data, input.recordId)
    if (query instanceof Error) return new SkillError("forbidden", "invalid source record", { cause: query })
    const actor = await new SkillActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const statement = () => this.c.env.DB.prepare(query.sql).bind(...query.values)
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([...actor.assertions, statement()])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("skill source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("skill source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "skill",
        recordKind: kind.data,
        recordId: input.recordId,
        formatId: kind.data,
        formatVersion: 1,
        sourceRevision: null,
        sourceRecordedAt: null,
        capturedAt: actor.now.toISOString(),
        contentDigest: digest.toString(),
      })
      if (source instanceof Error) return source
      return {
        source,
        content: new TextEncoder().encode(canonical.toString()),
        actorAccountId: actor.accountId,
        sourceAuthorizationRef: Object.freeze({
          context: "skill", kind: "record-snapshot", id: input.recordId, version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN (SELECT snapshot_json FROM (${query.sql})) IS ?${query.values.length + 1}
            THEN 1 ELSE json_extract('', '$') END`).bind(...query.values, snapshot),
        ],
      }
    } catch (cause) {
      return new Error("skill source capture failed", { cause })
    }
  }
}
