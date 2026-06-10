const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function toResourceId(raw: string): string | null {
  if (UUID_PATTERN.test(raw) === false) {
    return null
  }

  return raw
}
