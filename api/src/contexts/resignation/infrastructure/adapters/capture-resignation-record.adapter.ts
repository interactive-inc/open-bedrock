import type { ResignationContext } from "@/contexts/resignation/configuration/resignation-context"
import { ResignationActorReadAdapter } from "@/contexts/resignation/infrastructure/adapters/resignation-actor-read.adapter"
import { ResignationError } from "@/contexts/resignation/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { z } from "zod"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'resignation-record', 'version', 1,
  'resignation', json_object(
    'id', id,
    'employee_id', employee_id,
    'resignation_date', resignation_date,
    'last_working_date', last_working_date,
    'reason', reason,
    'status', status,
    'created_at', created_at
  )
) AS snapshot_json FROM resignations WHERE id = ?1`

type Context = ResignationContext

/** 管理資格のある主体へ退職申請の原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureResignationRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ resignationId: string; sourceNamespace: string }>) {
    if (!z.string().uuid().safeParse(input.resignationId).success)
      return new ResignationError("forbidden", "invalid source record")
    const actor = await new ResignationActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.resignationId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("resignation source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("resignation source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "resignation",
        recordKind: "resignation-record",
        recordId: String(input.resignationId),
        formatId: "resignation-record",
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
          context: "resignation",
          kind: "record-snapshot",
          id: String(input.resignationId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.resignationId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("resignation source capture failed", { cause })
    }
  }
}
