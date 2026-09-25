import { z } from "zod"
import type { WorkAccidentContext } from "@/contexts/work-accident/configuration/work-accident-context"
import { WorkAccidentActorReadAdapter } from "@/contexts/work-accident/infrastructure/adapters/work-accident-actor-read.adapter"
import { WorkAccidentError } from "@/contexts/work-accident/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'work-accident-record', 'version', 2,
  'work-accident', json_object(
    'id', id,
    'legacy_id', legacy_id,
    'occurred_on', occurred_on,
    'employee_id', employee_id,
    'location', location,
    'summary', summary,
    'severity', severity,
    'status', status,
    'created_at', created_at
  )
) AS snapshot_json FROM work_accidents WHERE id = ?1`

type Context = WorkAccidentContext

/** 管理資格のある主体へ労災・事故原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureWorkAccidentRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ workAccidentId: string; sourceNamespace: string }>) {
    if (!z.uuid().safeParse(input.workAccidentId).success)
      return new WorkAccidentError("forbidden", "invalid source record")
    const actor = await new WorkAccidentActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.workAccidentId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("work-accident source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("work-accident source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "work-accident",
        recordKind: "work-accident-record",
        recordId: String(input.workAccidentId),
        formatId: "work-accident-record",
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
          context: "work-accident",
          kind: "record-snapshot",
          id: String(input.workAccidentId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.workAccidentId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("work-accident source capture failed", { cause })
    }
  }
}
