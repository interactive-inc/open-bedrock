import type { BusinessTripContext } from "@/contexts/business-trip/configuration/business-trip-context"
import { BusinessTripActorReadAdapter } from "@/contexts/business-trip/infrastructure/adapters/business-trip-actor-read.adapter"
import { BusinessTripError } from "@/contexts/business-trip/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { z } from "zod"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'business-trip-record', 'version', 1,
  'business-trip', json_object(
    'id', id,
    'traveler_id', traveler_id,
    'destination', destination,
    'start_date', start_date,
    'end_date', end_date,
    'purpose', purpose,
    'estimated_cost', estimated_cost,
    'status', status,
    'created_at', created_at
  )
) AS snapshot_json FROM business_trips WHERE id = ?1`

type Context = BusinessTripContext

/** 管理資格のある主体へ出張申請原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureBusinessTripRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ businessTripId: string; sourceNamespace: string }>) {
    if (!z.string().uuid().safeParse(input.businessTripId).success)
      return new BusinessTripError("forbidden", "invalid source record")
    const actor = await new BusinessTripActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.businessTripId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("business-trip source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("business-trip source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "business-trip",
        recordKind: "business-trip-record",
        recordId: String(input.businessTripId),
        formatId: "business-trip-record",
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
          context: "business-trip",
          kind: "record-snapshot",
          id: String(input.businessTripId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.businessTripId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("business-trip source capture failed", { cause })
    }
  }
}
