import type { AntisocialCheckContext } from "@/contexts/antisocial-check/configuration/antisocial-check-context"
import { AntisocialCheckActorReadAdapter } from "@/contexts/antisocial-check/infrastructure/adapters/antisocial-check-actor-read.adapter"
import { AntisocialCheckError } from "@/contexts/antisocial-check/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { z } from "zod"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'antisocial-check-record', 'version', 1,
  'antisocial-check', json_object(
    'id', id,
    'requester_id', requester_id,
    'partner_name', partner_name,
    'partner_address', partner_address,
    'representative_name', representative_name,
    'result', result,
    'status', status,
    'created_at', created_at
  )
) AS snapshot_json FROM antisocial_checks WHERE id = ?1`

type Context = AntisocialCheckContext

/** 管理資格のある主体へantisocial check原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureAntisocialCheckRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ antisocialCheckId: string; sourceNamespace: string }>) {
    if (!z.string().uuid().safeParse(input.antisocialCheckId).success)
      return new AntisocialCheckError("forbidden", "invalid source record")
    const actor = await new AntisocialCheckActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.antisocialCheckId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("antisocial-check source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("antisocial-check source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "antisocial-check",
        recordKind: "antisocial-check-record",
        recordId: String(input.antisocialCheckId),
        formatId: "antisocial-check-record",
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
          context: "antisocial-check",
          kind: "record-snapshot",
          id: String(input.antisocialCheckId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.antisocialCheckId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("antisocial-check source capture failed", { cause })
    }
  }
}
