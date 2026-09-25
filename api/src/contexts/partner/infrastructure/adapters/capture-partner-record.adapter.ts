import type { PartnerContext } from "@/contexts/partner/configuration/partner-context"
import { PartnerActorReadAdapter } from "@/contexts/partner/infrastructure/adapters/partner-actor-read.adapter"
import { partnerSnapshotQuery } from "@/contexts/partner/infrastructure/adapters/lib/partner-snapshot-query"
import { PartnerError } from "@/contexts/partner/domain/errors"
import {
  partnerRecordKindSchema,
  type PartnerRecordKind,
} from "@/contexts/partner/domain/definitions/partner-record-kind.definition"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

type Context = PartnerContext

/** 取引先2台帳の原文を固定し、Systemへの保全直前にも同じ版を要求する。 */
export class CapturePartnerRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      recordKind: PartnerRecordKind
      recordId: string
      sourceNamespace: string
    }>,
  ) {
    const kind = partnerRecordKindSchema.safeParse(input.recordKind)
    if (!kind.success) return new PartnerError("forbidden", "invalid source record")
    const query = partnerSnapshotQuery(kind.data, input.recordId)
    if (query instanceof Error)
      return new PartnerError("forbidden", "invalid source record", { cause: query })
    const actor = await new PartnerActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const statement = () => this.c.env.DB.prepare(query.sql).bind(...query.values)
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        statement(),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("partner source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("partner source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "partner",
        recordKind: kind.data,
        recordId: input.recordId,
        formatId: kind.data,
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
          context: "partner",
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
      return new Error("partner source capture failed", { cause })
    }
  }
}
