import type { RoomContext } from "@/contexts/room/configuration/room-context"
import { RoomActorReadAdapter } from "@/contexts/room/infrastructure/adapters/room-actor-read.adapter"
import { roomSnapshotQuery } from "@/contexts/room/infrastructure/adapters/lib/room-snapshot-query"
import { RoomError } from "@/contexts/room/domain/errors"
import {
  roomRecordKindSchema,
  type RoomRecordKind,
} from "@/contexts/room/domain/definitions/room-record-kind.definition"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

type Context = RoomContext

/** 会議室2台帳の原文を固定し、Systemへの保全直前にも同じ版を要求する。 */
export class CaptureRoomRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      recordKind: RoomRecordKind
      recordId: string
      sourceNamespace: string
    }>,
  ) {
    const kind = roomRecordKindSchema.safeParse(input.recordKind)
    if (!kind.success) return new RoomError("forbidden", "invalid source record")
    const query = roomSnapshotQuery(kind.data, input.recordId)
    if (query instanceof Error)
      return new RoomError("forbidden", "invalid source record", { cause: query })
    const actor = await new RoomActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const statement = () => this.c.env.DB.prepare(query.sql).bind(...query.values)
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        statement(),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("room source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("room source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "room",
        recordKind: kind.data,
        recordId: input.recordId,
        formatId: kind.data,
        formatVersion: query.formatVersion,
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
          context: "room",
          kind: "record-snapshot",
          id: input.recordId,
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN (SELECT snapshot_json FROM (${query.sql})) IS ?${query.values.length + 1}
            THEN 1 ELSE json_extract('', '$') END`).bind(...query.values, snapshot),
        ],
      }
    } catch (cause) {
      return new Error("room source capture failed", { cause })
    }
  }
}
