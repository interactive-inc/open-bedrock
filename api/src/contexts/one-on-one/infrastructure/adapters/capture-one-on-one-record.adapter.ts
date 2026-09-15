import type { OneOnOneContext } from "@/contexts/one-on-one/configuration/one-on-one-context"
import { OneOnOneActorReadAdapter } from "@/contexts/one-on-one/infrastructure/adapters/one-on-one-actor-read.adapter"
import { OneOnOneError } from "@/contexts/one-on-one/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { z } from "zod"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'one-on-one-record', 'version', 1,
  'one-on-one', json_object(
    'id', id,
    'member_id', member_id,
    'manager_id', manager_id,
    'held_at', held_at,
    'topics', topics,
    'manager_note', manager_note,
    'next_action', next_action,
    'evaluation_sheet_id', evaluation_sheet_id
  )
) AS snapshot_json FROM one_on_ones WHERE id = ?1`

type Context = OneOnOneContext

/** 管理資格のある主体へ1on1原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureOneOnOneRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ oneOnOneId: string; sourceNamespace: string }>) {
    if (!z.string().uuid().safeParse(input.oneOnOneId).success)
      return new OneOnOneError("forbidden", "invalid source record")
    const actor = await new OneOnOneActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.oneOnOneId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("one-on-one source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("one-on-one source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "one-on-one",
        recordKind: "one-on-one-record",
        recordId: String(input.oneOnOneId),
        formatId: "one-on-one-record",
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
          context: "one-on-one",
          kind: "record-snapshot",
          id: String(input.oneOnOneId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.oneOnOneId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("one-on-one source capture failed", { cause })
    }
  }
}
