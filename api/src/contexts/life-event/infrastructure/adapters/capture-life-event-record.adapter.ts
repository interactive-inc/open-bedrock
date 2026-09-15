import type { LifeEventContext } from "@/contexts/life-event/configuration/life-event-context"
import { LifeEventActorReadAdapter } from "@/contexts/life-event/infrastructure/adapters/life-event-actor-read.adapter"
import { LifeEventError } from "@/contexts/life-event/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { z } from "zod"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'life-event-record', 'version', 1,
  'life-event', json_object(
    'id', id,
    'employee_id', employee_id,
    'event_type', event_type,
    'event_date', event_date,
    'detail', detail,
    'status', status,
    'created_at', created_at
  )
) AS snapshot_json FROM life_events WHERE id = ?1`

type Context = LifeEventContext

/** 管理資格のある主体へライフイベント届出の原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureLifeEventRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ lifeEventId: string; sourceNamespace: string }>) {
    if (!z.string().uuid().safeParse(input.lifeEventId).success)
      return new LifeEventError("forbidden", "invalid source record")
    const actor = await new LifeEventActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.lifeEventId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("life-event source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("life-event source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "life-event",
        recordKind: "life-event-record",
        recordId: String(input.lifeEventId),
        formatId: "life-event-record",
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
          context: "life-event",
          kind: "record-snapshot",
          id: String(input.lifeEventId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.lifeEventId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("life-event source capture failed", { cause })
    }
  }
}
