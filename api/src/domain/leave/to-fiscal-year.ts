export function toFiscalYear(now: string): string {
  const parsed = new Date(now)

  const year = parsed.getUTCFullYear()

  if (Number.isNaN(year)) {
    return ""
  }

  return String(year)
}
