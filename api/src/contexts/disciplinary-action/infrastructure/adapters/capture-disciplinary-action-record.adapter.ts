import type { DisciplinaryActionContext } from "@/contexts/disciplinary-action/configuration/disciplinary-action-context"
import { DisciplinaryActionActorReadAdapter } from "@/contexts/disciplinary-action/infrastructure/adapters/disciplinary-action-actor-read.adapter"
import { DisciplinaryActionError } from "@/contexts/disciplinary-action/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'disciplinary-action-record', 'version', 1,
  'disciplinary-action', json_object(
    'id', id,
    'employee_id', employee_id,
    'kind', kind,
    'summary', summary,
    'decided_on', decided_on,
    'created_at', created_at
  )
) AS snapshot_json FROM disciplinary_actions WHERE id = ?1`

type Context = DisciplinaryActionContext

/** 管理資格のある主体へ懲戒記録原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureDisciplinaryActionRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ disciplinaryActionId: number; sourceNamespace: string }>) {
    if (!Number.isSafeInteger(input.disciplinaryActionId))
      return new DisciplinaryActionError("forbidden", "invalid source record")
    const actor = await new DisciplinaryActionActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.disciplinaryActionId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("disciplinary-action source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("disciplinary-action source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "disciplinary-action",
        recordKind: "disciplinary-action-record",
        recordId: String(input.disciplinaryActionId),
        formatId: "disciplinary-action-record",
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
          context: "disciplinary-action",
          kind: "record-snapshot",
          id: String(input.disciplinaryActionId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.disciplinaryActionId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("disciplinary-action source capture failed", { cause })
    }
  }
}
