const standardWorkMinutes = 480

export function toOvertimeMinutes(workMinutes: number): number {
  const overtime = workMinutes - standardWorkMinutes

  if (overtime < 0) {
    return 0
  }

  return overtime
}
