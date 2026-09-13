import type { AttendanceRecordSourceContext } from "@/contexts/attendance/configuration/attendance-record-source-context"
import { AttendanceRecordSourceAuthorizationAdapter } from "@/contexts/attendance/infrastructure/adapters/attendance-record-source-authorization.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const snapshotSql = `SELECT json_object(
  'format', 'attendance-record', 'version', 1,
  'record', json_object('id', id, 'employee_id', employee_id, 'work_date', work_date,
    'clock_in_at', clock_in_at, 'clock_out_at', clock_out_at, 'work_minutes', work_minutes,
    'note', note, 'status', status)
) AS snapshot_json FROM attendance_records WHERE id = ?1`

/** 元行の全項目を取得し、存在しない改訂番号や記録日時を生成しない。 */
export class CaptureAttendanceRecordAdapter {
  constructor(private readonly c: AttendanceRecordSourceContext) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ recordId: number; sourceNamespace: string }>) {
    if (!Number.isSafeInteger(input.recordId) || input.recordId < 1)
      return new Error("invalid attendance source record")
    const actor = await new AttendanceRecordSourceAuthorizationAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.recordId),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("attendance source is unavailable")
      const snapshot = reads.at(-1)?.results[0]?.snapshot_json
      if (snapshot === undefined) return new Error("attendance source is unavailable")
      const canonical = CanonicalSystemJsonValue.create(JSON.parse(snapshot))
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "attendance",
        recordKind: "attendance-record",
        recordId: String(input.recordId),
        formatId: "attendance-record",
        formatVersion: 1,
        sourceRevision: null,
        sourceRecordedAt: null,
        capturedAt: actor.now.toISOString(),
        contentDigest: digest.toString(),
      })
      if (source instanceof Error) return source
      return Object.freeze({
        source,
        content: new TextEncoder().encode(canonical.toString()),
        actorAccountId: actor.accountId,
        sourceAuthorizationRef: Object.freeze({
          context: "attendance",
          kind: "record-snapshot",
          id: String(input.recordId),
          version: digest.toString(),
        }),
        assertions: Object.freeze([
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
            (SELECT snapshot_json FROM (${snapshotSql})) IS ?2
            THEN 1 ELSE json_extract('{}', 'attendance_source_changed') END`).bind(
            input.recordId,
            snapshot,
          ),
        ]),
      })
    } catch (cause) {
      return new Error("attendance source capture failed", { cause })
    }
  }
}
