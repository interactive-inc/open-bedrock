import { toIntInRange } from "@/lib/form/to-int-in-range"
import type { IntRangeOptions } from "@/lib/form/to-int-in-range"

export function toOptionalIntInRange(
  value: FormDataEntryValue | null,
  options: IntRangeOptions,
): number | Error | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return toIntInRange(value, options)
}
