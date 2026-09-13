import type { AttendanceRecordSourceContext } from "@/contexts/attendance/configuration/attendance-record-source-context"
import { AttendanceRecordSourceAuthorizationAdapter } from "@/contexts/attendance/infrastructure/adapters/attendance-record-source-authorization.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"

type Context = AttendanceRecordSourceContext

const snapshotSql = `SELECT json_object(
  'format', 'attendance-record', 'version', ?2,
  'record', json_object('id', id, 'employee_id', employee_id, 'work_date', work_date,
    'clock_in_at', clock_in_at, 'clock_out_at', clock_out_at, 'work_minutes', work_minutes,
    'note', note, 'status', status)
) AS snapshot_json,
  (typeof(work_minutes) != 'integer' OR work_minutes BETWEEN -9007199254740991 AND 9007199254740991)
    AS legacy_lossless
FROM attendance_records WHERE id = ?1`

/** 元行の全項目を取得し、存在しない改訂番号や記録日時を生成しない。 */
export class CaptureAttendanceRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      recordId: number
      sourceNamespace: string
      formatVersion?: 1 | 2
    }>,
  ) {
    const formatVersion = input.formatVersion ?? 2
    if (!Number.isSafeInteger(input.recordId) || input.recordId < 1)
      return new Error("invalid attendance source record")
    const actor = await new AttendanceRecordSourceAuthorizationAdapter(this.c).prepare()
    if (actor instanceof Error) return actor
    try {
      const reads = await this.c.env.DB.batch<{ snapshot_json: string; legacy_lossless: number }>([
        ...actor.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(input.recordId, formatVersion),
      ])
      if (reads.length !== actor.assertions.length + 1 || reads.some((read) => !read.success))
        return new Error("attendance source is unavailable")
      const row = reads.at(-1)?.results[0]
      if (formatVersion === 1 && row?.legacy_lossless !== 1)
        return new Error("legacy attendance content cannot represent the source integer exactly")
      const snapshot = row?.snapshot_json
      if (snapshot === undefined) return new Error("attendance source is unavailable")
      // 既存の承認対象は版1の本文とdigestを維持する。新規取得はDBのJSONを再解釈しない。
      const serialized =
        formatVersion === 1 ? CanonicalSystemJsonValue.create(JSON.parse(snapshot)) : snapshot
      if (serialized instanceof Error) return serialized
      const content = new TextEncoder().encode(serialized.toString())
      const digest = await toSha256Hex(content)
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: input.sourceNamespace,
        ownerContext: "attendance",
        recordKind: "attendance-record",
        recordId: String(input.recordId),
        formatId: "attendance-record",
        formatVersion,
        sourceRevision: null,
        sourceRecordedAt: null,
        capturedAt: actor.now.toISOString(),
        contentDigest: digest,
      })
      if (source instanceof Error) return source
      return Object.freeze({
        source,
        content,
        actorAccountId: actor.accountId,
        sourceAuthorizationRef: Object.freeze({
          context: "attendance",
          kind: "record-snapshot",
          id: String(input.recordId),
          version: digest,
        }),
        assertions: Object.freeze([
          ...actor.assertions,
          this.c.env.DB.prepare(`SELECT CASE WHEN
            (SELECT snapshot_json FROM (${snapshotSql})) IS ?3
            THEN 1 ELSE json_extract('{}', 'attendance_source_changed') END`).bind(
            input.recordId,
            formatVersion,
            snapshot,
          ),
        ]),
      })
    } catch (cause) {
      return new Error("attendance source capture failed", { cause })
    }
  }
}
