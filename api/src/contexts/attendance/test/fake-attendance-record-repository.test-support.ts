import { AttendanceRecord } from "@/contexts/attendance/domain/entities/attendance-record.entity"
import type { AttendanceRecordRepository } from "@/contexts/attendance/infrastructure/repositories/attendance-record.repository"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type RecordPort = Pick<AttendanceRecordRepository, "findOpenByEmployeeId" | "create" | "update">

/**
 * 勤怠記録Repositoryの型付きfake。SQLは模倣せず、保存したDomain modelを返す。
 * 出勤中の一意性と退勤の条件付き更新はRepositoryの戻り値の約束だけを再現し、
 * SQLとしての意味は attendance-record.repository.d1.test.ts で検証する。
 */
export function createFakeAttendanceRecordRepository(): {
  recordRepository: RecordPort
  records: AttendanceRecord[]
} {
  const records: AttendanceRecord[] = []

  const findOpen = (employeeId: EmployeeId) =>
    records.find((record) => record.employeeId === employeeId && record.status === "open") ?? null

  const recordRepository: RecordPort = {
    findOpenByEmployeeId: async (employeeId) => findOpen(employeeId),
    create: async (attendanceRecord) => {
      const saved = new AttendanceRecord({
        id: records.length + 1,
        employeeId: attendanceRecord.employeeId,
        workDate: attendanceRecord.workDate,
        clockInAt: attendanceRecord.clockInAt,
        clockOutAt: attendanceRecord.clockOutAt,
        workMinutes: attendanceRecord.workMinutes,
        note: attendanceRecord.note,
        status: attendanceRecord.status,
      })
      records.push(saved)
      return saved
    },
    update: async (attendanceRecord) => {
      const index = records.findIndex(
        (record) => record.id === attendanceRecord.id && record.status === "open",
      )
      if (index === -1) return null
      records[index] = attendanceRecord
      return attendanceRecord
    },
  }

  return { recordRepository, records }
}
