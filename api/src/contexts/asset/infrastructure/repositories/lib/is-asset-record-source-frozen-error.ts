/** D1とORMが包んだ原因から、asset記録の書込み停止だけを判別する。 */
export function isAssetRecordSourceFrozenError(error: unknown): boolean {
  const visited = new Set<unknown>()
  const inspect = (value: unknown): boolean => {
    if (!(value instanceof Error) || visited.has(value)) return false
    visited.add(value)
    if (/^(?:D1_ERROR: )?asset_record_source_frozen(?:[: ].*)?$/.test(value.message))
      return true
    return inspect(value.cause)
  }
  return inspect(error)
}
