import type { CertificationContext } from "@/contexts/certification/configuration/certification-context"
import { CertificationActorReadAdapter } from "@/contexts/certification/infrastructure/adapters/certification-actor-read.adapter"
import { CertificationError } from "@/contexts/certification/domain/errors"
import {
  certificationRecordKindSchema,
  type CertificationRecordKind,
} from "@/contexts/certification/domain/definitions/certification-record-kind.definition"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"

type Context = CertificationContext
type SnapshotQuery = Readonly<{ sql: string; values: ReadonlyArray<string | number> }>

function numericId(recordId: string): number | null {
  const parsed = z.coerce.number().int().positive().safe().safeParse(recordId)
  return parsed.success && String(parsed.data) === recordId ? parsed.data : null
}

function snapshotQuery(
  recordKind: CertificationRecordKind,
  recordId: string,
): SnapshotQuery | Error {
  const id = numericId(recordId)
  if (id === null) return new Error("invalid certification record id")
  if (recordKind === "certification-record") {
    return {
      sql: `SELECT json_object('format','certification-record','version',1,'certification',json_object(
        'id',id,'code',code,'name',name,'issuer',issuer,'description',description,'created_at',created_at))
        AS snapshot_json FROM certification_definitions WHERE id=?1`,
      values: [id],
    }
  }
  return {
    sql: `SELECT json_object('format','employee-certification-record','version',1,'employeeCertification',json_object(
      'id',id,'employee_id',employee_id,'certification_id',certification_id,'acquired_on',acquired_on,
      'expires_on',expires_on,'note',note,'created_at',created_at))
      AS snapshot_json FROM employee_certifications WHERE id=?1`,
    values: [id],
  }
}

/** 保全資格のある主体へ資格2台帳の原記録を返し、保存直前にも同じ内容を検査する。 */
export class CaptureCertificationRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      recordKind: CertificationRecordKind
      recordId: string
      sourceNamespace: string
    }>,
  ) {
    const kind = certificationRecordKindSchema.safeParse(input.recordKind)
    if (!kind.success) return new CertificationError("forbidden", "invalid source record")
    const query = snapshotQuery(kind.data, input.recordId)
    if (query instanceof Error)
      return new CertificationError("forbidden", "invalid source record", { cause: query })
    const actor = await new CertificationActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const statement = () => this.c.env.DB.prepare(query.sql).bind(...query.values)
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        statement(),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("certification source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("certification source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "certification",
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
          context: "certification",
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
      return new Error("certification source capture failed", { cause })
    }
  }
}
