import { z } from "zod"
import type { HealthCheckupContext } from "@/contexts/health-checkup/configuration/health-checkup-context"
import { HealthCheckupActorReadAdapter } from "@/contexts/health-checkup/infrastructure/adapters/health-checkup-actor-read.adapter"
import { HealthCheckupError } from "@/contexts/health-checkup/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'health-checkup-record', 'version', 2,
  'health-checkup', json_object(
    'id', id,
    'legacy_id', legacy_id,
    'employee_id', employee_id,
    'fiscal_year', fiscal_year,
    'checkup_kind', checkup_kind,
    'conducted_on', conducted_on,
    'status', status,
    'note', note,
    'created_at', created_at
  )
) AS snapshot_json FROM health_checkups WHERE id = ?1`

type Context = HealthCheckupContext

/** 管理資格のある主体へ健康診断実施記録原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureHealthCheckupRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ healthCheckupId: string; sourceNamespace: string }>) {
    if (!z.uuid().safeParse(input.healthCheckupId).success)
      return new HealthCheckupError("forbidden", "invalid source record")
    const actor = await new HealthCheckupActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.healthCheckupId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("health-checkup source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("health-checkup source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "health-checkup",
        recordKind: "health-checkup-record",
        recordId: String(input.healthCheckupId),
        formatId: "health-checkup-record",
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
          context: "health-checkup",
          kind: "record-snapshot",
          id: String(input.healthCheckupId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.healthCheckupId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("health-checkup source capture failed", { cause })
    }
  }
}
