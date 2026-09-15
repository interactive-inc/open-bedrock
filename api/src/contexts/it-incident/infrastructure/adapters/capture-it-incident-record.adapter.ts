import type { ItIncidentContext } from "@/contexts/it-incident/configuration/it-incident-context"
import { ItIncidentActorReadAdapter } from "@/contexts/it-incident/infrastructure/adapters/it-incident-actor-read.adapter"
import { ItIncidentError } from "@/contexts/it-incident/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'it-incident-record', 'version', 1,
  'it-incident', json_object(
    'id', id,
    'occurred_at', occurred_at,
    'title', title,
    'summary', summary,
    'severity', severity,
    'status', status,
    'resolved_at', resolved_at,
    'created_at', created_at
  )
) AS snapshot_json FROM it_incidents WHERE id = ?1`

type Context = ItIncidentContext

/** 管理資格のある主体へITインシデント原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureItIncidentRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ itIncidentId: number; sourceNamespace: string }>) {
    if (!Number.isSafeInteger(input.itIncidentId) || input.itIncidentId < 1)
      return new ItIncidentError("forbidden", "invalid source record")
    const actor = await new ItIncidentActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.itIncidentId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("it-incident source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("it-incident source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "it-incident",
        recordKind: "it-incident-record",
        recordId: String(input.itIncidentId),
        formatId: "it-incident-record",
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
          context: "it-incident",
          kind: "record-snapshot",
          id: String(input.itIncidentId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.itIncidentId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("it-incident source capture failed", { cause })
    }
  }
}
