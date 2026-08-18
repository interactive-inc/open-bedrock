export function isCompanyIdentifier(value: string): boolean {
  return value.length >= 1 && value.length <= 255 && value.trim() === value && !/\s/.test(value)
}
