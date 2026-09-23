/** D1とORMが包んだ原因から、training記録の書込み停止だけを判別する。 */
export function isTrainingRecordSourceFrozenError(error: unknown): boolean {
  const visited = new Set<unknown>()
  const inspect = (value: unknown): boolean => {
    if (!(value instanceof Error) || visited.has(value)) return false
    visited.add(value)
    if (/^(?:D1_ERROR: )?training_record_source_frozen(?:[: ].*)?$/.test(value.message)) return true
    return inspect(value.cause)
  }
  return inspect(error)
}
