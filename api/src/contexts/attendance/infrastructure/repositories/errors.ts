/** 原記録の保全中に書込みを拒否したことを表す。 */
export class AttendanceRecordSourceFrozenError extends Error {
  constructor(cause: unknown) {
    super("Attendance record writes are frozen for preservation", { cause })
    this.name = "AttendanceRecordSourceFrozenError"
  }
}
