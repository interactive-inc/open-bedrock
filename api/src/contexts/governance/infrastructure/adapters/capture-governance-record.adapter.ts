import type { GovernanceContext } from "@/contexts/governance/configuration/governance-context"
import { GovernanceActorReadAdapter } from "@/contexts/governance/infrastructure/adapters/governance-actor-read.adapter"
import { governanceSnapshotQuery } from "@/contexts/governance/infrastructure/adapters/lib/governance-snapshot-query"
import { GovernanceError } from "@/contexts/governance/domain/errors"
import {
  governanceRecordKindSchema,
  type GovernanceRecordKind,
} from "@/contexts/governance/domain/definitions/governance-record-kind.definition"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

type Context = GovernanceContext

/** 規程・ガバナンス8台帳の原文を固定し、Systemへの保全直前にも同じ版を要求する。 */
export class CaptureGovernanceRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      recordKind: GovernanceRecordKind
      recordId: string
      sourceNamespace: string
    }>,
  ) {
    const kind = governanceRecordKindSchema.safeParse(input.recordKind)
    if (!kind.success) return new GovernanceError("forbidden", "invalid source record")
    const query = governanceSnapshotQuery(kind.data, input.recordId)
    if (query instanceof Error)
      return new GovernanceError("forbidden", "invalid source record", { cause: query })
    const actor = await new GovernanceActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const statement = () => this.c.env.DB.prepare(query.sql).bind(...query.values)
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        statement(),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("governance source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("governance source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "governance",
        recordKind: kind.data,
        recordId: input.recordId,
        formatId: kind.data,
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
          context: "governance",
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
      return new Error("governance source capture failed", { cause })
    }
  }
}
