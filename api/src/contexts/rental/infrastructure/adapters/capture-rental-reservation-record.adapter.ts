import type { RentalReservationContext } from "@/contexts/rental/configuration/rental-context"
import { RentalReservationActorReadAdapter } from "@/contexts/rental/infrastructure/adapters/rental-reservation-actor-read.adapter"
import { RentalReservationError } from "@/contexts/rental/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { z } from "zod"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'rental-reservation-record', 'version', 1,
  'rental', json_object(
    'id', id,
    'requester_id', requester_id,
    'item_name', item_name,
    'start_date', start_date,
    'end_date', end_date,
    'purpose', purpose,
    'status', status,
    'created_at', created_at
  )
) AS snapshot_json FROM rental_reservations WHERE id = ?1`

type Context = RentalReservationContext

/** 管理資格のある主体へrental reservation原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureRentalReservationRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ rentalReservationId: string; sourceNamespace: string }>) {
    if (!z.string().uuid().safeParse(input.rentalReservationId).success)
      return new RentalReservationError("forbidden", "invalid source record")
    const actor = await new RentalReservationActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.rentalReservationId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("rental source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("rental source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "rental",
        recordKind: "rental-reservation-record",
        recordId: String(input.rentalReservationId),
        formatId: "rental-reservation-record",
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
          context: "rental",
          kind: "record-snapshot",
          id: String(input.rentalReservationId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.rentalReservationId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("rental source capture failed", { cause })
    }
  }
}
