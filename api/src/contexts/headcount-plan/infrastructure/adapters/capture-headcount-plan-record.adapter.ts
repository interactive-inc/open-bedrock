import type { HeadcountPlanContext } from "@/contexts/headcount-plan/configuration/headcount-plan-context"
import { HeadcountPlanActorReadAdapter } from "@/contexts/headcount-plan/infrastructure/adapters/headcount-plan-actor-read.adapter"
import { HeadcountPlanError } from "@/contexts/headcount-plan/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'headcount-plan-record', 'version', 1,
  'headcount-plan', json_object(
    'id', id,
    'fiscal_year', fiscal_year,
    'department_code', department_code,
    'planned_count', planned_count,
    'note', note,
    'created_at', created_at
  )
) AS snapshot_json FROM headcount_plans WHERE id = ?1`

type Context = HeadcountPlanContext

/** 管理資格のある主体へ人員計画原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureHeadcountPlanRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ headcountPlanId: number; sourceNamespace: string }>) {
    if (!Number.isSafeInteger(input.headcountPlanId) || input.headcountPlanId < 1)
      return new HeadcountPlanError("forbidden", "invalid source record")
    const actor = await new HeadcountPlanActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.headcountPlanId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("headcount-plan source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("headcount-plan source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "headcount-plan",
        recordKind: "headcount-plan-record",
        recordId: String(input.headcountPlanId),
        formatId: "headcount-plan-record",
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
          context: "headcount-plan",
          kind: "record-snapshot",
          id: String(input.headcountPlanId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.headcountPlanId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("headcount-plan source capture failed", { cause })
    }
  }
}
