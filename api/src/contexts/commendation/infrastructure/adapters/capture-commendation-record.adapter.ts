import type { CommendationContext } from "@/contexts/commendation/configuration/commendation-context"
import { CommendationActorReadAdapter } from "@/contexts/commendation/infrastructure/adapters/commendation-actor-read.adapter"
import { CommendationError } from "@/contexts/commendation/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'commendation-record', 'version', 1,
  'commendation', json_object(
    'id', id,
    'employee_id', employee_id,
    'title', title,
    'reason', reason,
    'awarded_on', awarded_on,
    'created_at', created_at
  )
) AS snapshot_json FROM commendations WHERE id = ?1`

type Context = CommendationContext

/** 管理資格のある主体へ表彰原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureCommendationRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ commendationId: number; sourceNamespace: string }>) {
    if (!Number.isSafeInteger(input.commendationId) || input.commendationId < 1)
      return new CommendationError("forbidden", "invalid source record")
    const actor = await new CommendationActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.commendationId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("commendation source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("commendation source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "commendation",
        recordKind: "commendation-record",
        recordId: String(input.commendationId),
        formatId: "commendation-record",
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
          context: "commendation",
          kind: "record-snapshot",
          id: String(input.commendationId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.commendationId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("commendation source capture failed", { cause })
    }
  }
}
