import type { CareerContext } from "@/contexts/career/configuration/career-context"
import { CareerError } from "@/contexts/career/domain/errors"
import {
  careerRecordKindSchema,
  type CareerRecordKind,
} from "@/contexts/career/domain/definitions/career-record-kind.definition"
import { CareerActorReadAdapter } from "@/contexts/career/infrastructure/adapters/career-actor-read.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

type Context = CareerContext

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string | number> }>

function snapshotQuery(recordKind: CareerRecordKind, recordId: string): SnapshotQuery | Error {
  if (recordKind === "career-sheet-record") {
    if (recordId.length === 0) return new Error("invalid career record id")
    return {
      sql: `SELECT json_object('format','career-sheet-record','version',1,'sheet',json_object(
        'employee_id',employee_id,'goals_text',goals_text,'strengths_text',strengths_text,
        'updated_at',updated_at)) AS snapshot_json FROM career_sheets WHERE employee_id=?1`,
      values: [recordId],
    }
  }
  const id = Number(recordId)
  if (!Number.isSafeInteger(id) || String(id) !== recordId)
    return new Error("invalid career record id")
  return recordKind === "career-posting-record"
    ? {
        sql: `SELECT json_object('format','career-posting-record','version',1,'posting',json_object(
          'id',id,'title',title,'dept_id',dept_id,'dept_name',dept_name,
          'required_skills',required_skills,'status',status)) AS snapshot_json
          FROM career_postings WHERE id=?1`,
        values: [id],
      }
    : {
        sql: `SELECT json_object('format','career-application-record','version',1,'application',json_object(
          'id',id,'posting_id',posting_id,'applicant_id',applicant_id,'message',message,
          'status',status)) AS snapshot_json FROM career_applications WHERE id=?1`,
        values: [id],
      }
}

/** 保全資格のある主体へキャリア3台帳の原記録を返し、保存直前にも同じ内容を検査する。 */
export class CaptureCareerRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{ recordKind: CareerRecordKind; recordId: string; sourceNamespace: string }>,
  ) {
    const kind = careerRecordKindSchema.safeParse(input.recordKind)
    if (!kind.success) return new CareerError("forbidden", "invalid source record")
    const query = snapshotQuery(kind.data, input.recordId)
    if (query instanceof Error)
      return new CareerError("forbidden", "invalid source record", { cause: query })
    const actor = await new CareerActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const statement = () => this.c.env.DB.prepare(query.sql).bind(...query.values)
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        statement(),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("career source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("career source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "career",
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
          context: "career",
          kind: "record-snapshot",
          id: input.recordId,
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(
            `SELECT CASE WHEN (SELECT snapshot_json FROM (${query.sql})) IS ?${query.values.length + 1}
              THEN 1 ELSE json_extract('', '$') END`,
          ).bind(...query.values, snapshot),
        ],
      }
    } catch (cause) {
      return new Error("career source capture failed", { cause })
    }
  }
}
