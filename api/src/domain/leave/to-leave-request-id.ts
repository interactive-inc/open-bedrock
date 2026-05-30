export function toLeaveRequestId(raw: string): number | null {
  const parsed = Number(raw)

  if (!Number.isInteger(parsed)) {
    return null
  }

  if (parsed <= 0) {
    return null
  }

  return parsed
}
