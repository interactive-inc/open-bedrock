import { validateIsoDate } from "@/lib/form/validate-iso-date"

export function toOptionalIsoDate(
  value: FormDataEntryValue | null,
  label: string,
): string | Error | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return validateIsoDate(value.trim(), label)
}
