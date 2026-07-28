import { toIntInRange } from "@/lib/form/to-int-in-range"
import type { IntRangeOptions } from "@/lib/form/to-int-in-range"

export function toRequiredIntInRange(
  value: FormDataEntryValue | null,
  options: IntRangeOptions,
): number | Error {
  if (typeof value !== "string" || value.trim() === "") {
    return new Error(`${options.label}を入力してください`)
  }

  return toIntInRange(value, options)
}
