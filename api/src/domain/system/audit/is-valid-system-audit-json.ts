/** SQL列へ保存する監査JSONが完全なJSON valueかを検査する。 */
export function isValidSystemAuditJson(value: string | null): boolean {
  if (value === null) return true
  if (typeof value !== "string") return false

  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}
