import { z } from "zod"
import type { CompensationChangeContext } from "@/contexts/compensation-change/configuration/compensation-change-context"
import { CompensationChangeError } from "@/contexts/compensation-change/domain/errors"
import {
  compensationChangeRecordKindSchema,
  type CompensationChangeRecordKind,
} from "@/contexts/compensation-change/domain/definitions/compensation-change-record-kind.definition"
import { CompensationChangeActorReadAdapter } from "@/contexts/compensation-change/infrastructure/adapters/compensation-change-actor-read.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

type Context = CompensationChangeContext

type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string> }>

function snapshotQuery(
  recordKind: CompensationChangeRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  const parsed = compensationChangeRecordKindSchema.safeParse(recordKind)
  if (!parsed.success || !z.uuid().safeParse(recordId).success)
    return new Error("invalid compensation change record id")
  return {
    sql: `SELECT json_object('format','salary-revision-record','version',2,'salary_revision',json_object(
      'id',id,'legacy_id',legacy_id,'employee_id',employee_id,'effective_date',effective_date,
      'previous_base_salary',previous_base_salary,'new_base_salary',new_base_salary,
      'reason',reason,'created_at',created_at)) AS snapshot_json FROM salary_revisions WHERE id=?1`,
    values: [recordId],
  }
}

/** 給与改定の原記録を保全資格のある主体へ返し、保存直前にも同じ内容を検査する。 */
export class CaptureCompensationChangeRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      recordKind: CompensationChangeRecordKind
      recordId: string
      sourceNamespace: string
    }>,
  ) {
    const query = snapshotQuery(input.recordKind, input.recordId)
    if (query instanceof Error)
      return new CompensationChangeError("forbidden", "invalid source record", { cause: query })
    const actor = await new CompensationChangeActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const statement = () => this.c.env.DB.prepare(query.sql).bind(...query.values)
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        statement(),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("compensation change source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("compensation change source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "compensation-change",
        recordKind: input.recordKind,
        recordId: input.recordId,
        formatId: input.recordKind,
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
          context: "compensation-change",
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
      return new Error("compensation change source capture failed", { cause })
    }
  }
}
