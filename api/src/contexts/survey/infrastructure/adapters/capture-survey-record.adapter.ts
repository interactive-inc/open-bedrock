import type { SurveyContext } from "@/contexts/survey/configuration/survey-context"
import { SurveyActorReadAdapter } from "@/contexts/survey/infrastructure/adapters/survey-actor-read.adapter"
import { SurveyError } from "@/contexts/survey/domain/errors"
import {
  surveyRecordKindSchema,
  type SurveyRecordKind,
} from "@/contexts/survey/domain/definitions/survey-record-kind.definition"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"

type Context = SurveyContext
type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string | number> }>
function snapshotQuery(recordKind: SurveyRecordKind, recordId: string): SnapshotQuery | Error {
  const parsed = z.coerce.number().int().safe().safeParse(recordId)
  if (!parsed.success || String(parsed.data) !== recordId)
    return new Error("invalid survey record id")
  const id = parsed.data
  return recordKind === "survey-record"
    ? {
        sql: `SELECT json_object('format','survey-record','version',1,'survey',json_object(
      'id',id,'title',title,'status',status,'questions_json',questions_json))
      AS snapshot_json FROM surveys WHERE id=?1`,
        values: [id],
      }
    : {
        sql: `SELECT json_object('format','survey-response-record','version',1,'response',json_object(
      'id',id,'survey_id',survey_id,'respondent_id',respondent_id,'answers_json',answers_json,
      'submitted_at',submitted_at)) AS snapshot_json FROM survey_responses WHERE id=?1`,
        values: [id],
      }
}
/** 保全資格のある主体へアンケート2台帳の原記録を返し、保存直前にも同じ内容を検査する。 */
export class CaptureSurveyRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async prepare(
    input: Readonly<{ recordKind: SurveyRecordKind; recordId: string; sourceNamespace: string }>,
  ) {
    const kind = surveyRecordKindSchema.safeParse(input.recordKind)
    if (!kind.success) return new SurveyError("forbidden", "invalid source record")
    const query = snapshotQuery(kind.data, input.recordId)
    if (query instanceof Error)
      return new SurveyError("forbidden", "invalid source record", { cause: query })
    const actor = await new SurveyActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const statement = () => this.c.env.DB.prepare(query.sql).bind(...query.values)
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        statement(),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("survey source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("survey source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "survey",
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
          context: "survey",
          kind: "record-snapshot",
          id: input.recordId,
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN (SELECT snapshot_json FROM (${query.sql})) IS ?${query.values.length + 1}
          THEN 1 ELSE json_extract('', '$') END`).bind(...query.values, snapshot),
        ],
      }
    } catch (cause) {
      return new Error("survey source capture failed", { cause })
    }
  }
}
