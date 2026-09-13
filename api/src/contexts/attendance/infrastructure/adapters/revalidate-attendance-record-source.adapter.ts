import type { AttendanceRecordSourceContext } from "@/contexts/attendance/configuration/attendance-record-source-context"
import { CaptureAttendanceRecordAdapter } from "@/contexts/attendance/infrastructure/adapters/capture-attendance-record.adapter"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"

type Context = AttendanceRecordSourceContext & Readonly<{ sourceNamespace: string }>

/** 提案の取得時点を保ったまま、現在の原記録との完全一致を確認する。 */
export class RevalidateAttendanceRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "attendance" ||
      source.props.recordKind !== "attendance-record"
    )
      return new Error("record source does not belong to this attendance registry")
    const current = await new CaptureAttendanceRecordAdapter(this.c).prepare({
      recordId: Number(source.props.recordId),
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new Error("attendance record differs from preservation proposal")
    return Object.freeze({ ...current, source })
  }
}
