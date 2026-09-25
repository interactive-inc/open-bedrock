import type { TrainingContext } from "@/contexts/training/configuration/training-context"
import { TrainingActorReadAdapter } from "@/contexts/training/infrastructure/adapters/training-actor-read.adapter"
import { TrainingError } from "@/contexts/training/domain/errors"
import {
  trainingRecordKindSchema,
  type TrainingRecordKind,
} from "@/contexts/training/domain/definitions/training-record-kind.definition"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"

type Context = TrainingContext
type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string> }>

/** 版 2 は主キーを UUID へ移し、移行前の整数の主キー legacy_id と created_at を含める。 */
function snapshotQuery(recordKind: TrainingRecordKind, recordId: string): SnapshotQuery | Error {
  if (!z.uuid().safeParse(recordId).success) return new Error("invalid training record id")
  const id = recordId
  if (recordKind === "training-course-record") {
    return {
      sql: `SELECT json_object('format','training-course-record','version',2,'course',json_object(
        'id',id,'legacy_id',legacy_id,'code',code,'title',title,'description',description,'duration_minutes',duration_minutes,
        'category',category,'is_required',is_required,'status',status,'created_at',created_at))
        AS snapshot_json FROM training_courses WHERE id=?1`,
      values: [id],
    }
  }
  return {
    sql: `SELECT json_object('format','training-enrollment-record','version',2,'enrollment',json_object(
      'id',id,'legacy_id',legacy_id,'course_id',course_id,'employee_id',employee_id,'status',status,'completed_at',completed_at,
      'score',score,'due_date',due_date,'created_at',created_at))
      AS snapshot_json FROM training_enrollments WHERE id=?1`,
    values: [id],
  }
}

/** 保全資格のある主体へ研修2台帳の原記録を返し、保存直前にも同じ内容を検査する。 */
export class CaptureTrainingRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{ recordKind: TrainingRecordKind; recordId: string; sourceNamespace: string }>,
  ) {
    const kind = trainingRecordKindSchema.safeParse(input.recordKind)
    if (!kind.success) return new TrainingError("forbidden", "invalid source record")
    const query = snapshotQuery(kind.data, input.recordId)
    if (query instanceof Error)
      return new TrainingError("forbidden", "invalid source record", { cause: query })
    const actor = await new TrainingActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const statement = () => this.c.env.DB.prepare(query.sql).bind(...query.values)
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        statement(),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("training source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("training source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "training",
        recordKind: kind.data,
        recordId: input.recordId,
        formatId: kind.data,
        formatVersion: 2,
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
          context: "training",
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
      return new Error("training source capture failed", { cause })
    }
  }
}
