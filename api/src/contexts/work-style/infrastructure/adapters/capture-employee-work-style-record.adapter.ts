import type { EmployeeWorkStyleContext } from "@/contexts/work-style/configuration/work-style-context"
import { EmployeeWorkStyleActorReadAdapter } from "@/contexts/work-style/infrastructure/adapters/work-style-actor-read.adapter"
import { EmployeeWorkStyleError } from "@/contexts/work-style/domain/errors"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'employee-work-style-record', 'version', 1,
  'employee-work-style', json_object(
    'id', id,
    'employee_id', employee_id,
    'style', style,
    'starts_on', starts_on,
    'ends_on', ends_on,
    'note', note,
    'created_at', created_at
  )
) AS snapshot_json FROM employee_work_styles WHERE id = ?1`

type Context = EmployeeWorkStyleContext

/** 管理資格のある主体へ勤務形態原記録を返し、保全までの変更・資格失効を検出する。 */
export class CaptureEmployeeWorkStyleRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ employeeWorkStyleId: number; sourceNamespace: string }>) {
    if (!Number.isSafeInteger(input.employeeWorkStyleId))
      return new EmployeeWorkStyleError("forbidden", "invalid source record")
    const actor = await new EmployeeWorkStyleActorReadAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.employeeWorkStyleId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("work-style source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("work-style source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "work-style",
        recordKind: "employee-work-style-record",
        recordId: String(input.employeeWorkStyleId),
        formatId: "employee-work-style-record",
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
          context: "work-style",
          kind: "record-snapshot",
          id: String(input.employeeWorkStyleId),
          version: digest.toString(),
        }),
        assertions: [
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
          (SELECT snapshot_json FROM (${snapshotSql})) IS ?2 THEN 1 ELSE json_extract('', '$') END`).bind(
            input.employeeWorkStyleId,
            snapshot,
          ),
        ],
      }
    } catch (cause) {
      return new Error("work-style source capture failed", { cause })
    }
  }
}
