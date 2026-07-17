const MAX_CANDIDATES = 20

// UI のカンマ・空白区切り入力を API の正整数配列に変換する。
export function parseCandidateEmployeeIds(raw: string): ReadonlyArray<number> | null {
  const values = raw.trim().split(/[\s,]+/)

  if (values.length === 0 || values[0] === "") {
    return null
  }

  const candidates: number[] = []
  const seen = new Set<number>()

  for (const value of values) {
    if (/^\d+$/.test(value) === false) {
      return null
    }

    const candidate = Number(value)

    if (Number.isSafeInteger(candidate) === false || candidate <= 0) {
      return null
    }

    if (seen.has(candidate) === false) {
      seen.add(candidate)
      candidates.push(candidate)
    }
  }

  if (candidates.length === 0 || candidates.length > MAX_CANDIDATES) {
    return null
  }

  return candidates
}
