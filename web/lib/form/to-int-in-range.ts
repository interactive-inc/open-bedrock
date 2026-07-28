export type IntRangeOptions = {
  label: string
  min: number
  max: number
}

export function toIntInRange(value: string, options: IntRangeOptions): number | Error {
  const parsed = Number(value)

  if (Number.isSafeInteger(parsed) === false) {
    return new Error(`${options.label}は整数で入力してください`)
  }

  if (parsed < options.min || parsed > options.max) {
    return new Error(`${options.label}は${options.min}〜${options.max}の範囲で入力してください`)
  }

  return parsed
}
