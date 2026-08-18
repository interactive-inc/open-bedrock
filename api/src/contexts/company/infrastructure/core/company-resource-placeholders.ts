export function companyResourcePlaceholders(values: ReadonlyArray<unknown>): string {
  return values.map(() => "?").join(", ")
}
