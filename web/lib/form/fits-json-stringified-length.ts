export function fitsJsonStringifiedLength(value: unknown, max: number): boolean {
  try {
    return JSON.stringify(value).length <= max
  } catch {
    return false
  }
}
