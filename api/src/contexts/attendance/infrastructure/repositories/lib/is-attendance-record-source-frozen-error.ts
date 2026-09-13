/** D1とORMが包んだ原因から、打刻の書込み停止triggerの拒否だけを判別する。 */
export function isAttendanceRecordSourceFrozenError(error: unknown): boolean {
  const visited = new Set<unknown>()
  const inspect = (value: unknown): boolean => {
    if (!(value instanceof Error) || visited.has(value)) return false
    visited.add(value)
    if (/^(?:D1_ERROR: )?attendance_record_source_frozen(?:[: ].*)?$/.test(value.message))
      return true
    return inspect(value.cause)
  }
  return inspect(error)
}
