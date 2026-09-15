import type { FamilyCareLeaveContext } from "@/contexts/family-care-leave/configuration/family-care-leave-context"
import { FamilyCareLeaveActorReadAdapter } from "@/contexts/family-care-leave/infrastructure/adapters/family-care-leave-actor-read.adapter"
import { FamilyCareLeaveError } from "@/contexts/family-care-leave/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { z } from "zod"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'family-care-leave-record', 'version', 1,
  'family-care-leave', json_object(
    'id', id,
    'employee_id', employee_id,
    'leave_kind', leave_kind,
    'start_date', start_date,
    'end_date', end_date,
    'note', note,
    'status', status,
    'created_at', created_at
  )
) AS snapshot_json FROM family_care_leaves WHERE id = ?1`

type Context = FamilyCareLeaveContext

/** 管理資格のある主体へ休業申出の原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureFamilyCareLeaveRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ familyCareLeaveId: string; sourceNamespace: string }>) {
    if (!z.string().uuid().safeParse(input.familyCareLeaveId).success)
      return new FamilyCareLeaveError("forbidden", "invalid source record")
    const actor = await new FamilyCareLeaveActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.familyCareLeaveId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("family-care-leave source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("family-care-leave source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "family-care-leave",
        recordKind: "family-care-leave-record",
        recordId: String(input.familyCareLeaveId),
        formatId: "family-care-leave-record",
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
          context: "family-care-leave",
          kind: "record-snapshot",
          id: String(input.familyCareLeaveId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.familyCareLeaveId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("family-care-leave source capture failed", { cause })
    }
  }
}
