import { PayloadTooLargeError, ValidationError } from "@/lib/errors"

export type AuditJsonValue =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<AuditJsonValue>
  | { readonly [key: string]: AuditJsonValue }

const maximumAuditJsonBytes = 65_536
const maximumAuditJsonDepth = 100
const redactedValue = "[REDACTED]"
const exactSensitiveKeys = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "setcookie",
  "privatekey",
  "clientsecret",
])

function invalidJson(options?: ErrorOptions): ValidationError {
  return new ValidationError(
    "audit JSON contains an unsupported value",
    "audit_invalid_json",
    options,
  )
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replaceAll(/[_-]/g, "")

  return (
    exactSensitiveKeys.has(normalized) ||
    normalized.startsWith("password") ||
    normalized.endsWith("token")
  )
}

function compareUnicodeCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, (value) => value.codePointAt(0) as number)
  const rightPoints = Array.from(right, (value) => value.codePointAt(0) as number)
  const sharedLength = Math.min(leftPoints.length, rightPoints.length)

  for (let index = 0; index < sharedLength; index += 1) {
    const difference = (leftPoints[index] as number) - (rightPoints[index] as number)
    if (difference !== 0) return difference
  }

  return leftPoints.length - rightPoints.length
}

function serializePrimitive(value: null | boolean | number | string): string {
  if (typeof value === "number" && !Number.isFinite(value)) throw invalidJson()

  return JSON.stringify(value)
}

function assertNoAccessorsOrSymbols(value: object): PropertyDescriptorMap {
  if (Object.getOwnPropertySymbols(value).length > 0) throw invalidJson()

  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const descriptor of Object.values(descriptors)) {
    if (descriptor?.get !== undefined || descriptor?.set !== undefined) throw invalidJson()
  }

  return descriptors
}

function serializeArray(
  value: ReadonlyArray<AuditJsonValue>,
  depth: number,
  ancestors: WeakSet<object>,
): string {
  const descriptors = assertNoAccessorsOrSymbols(value)
  const allowedNames = new Set(["length"])

  for (let index = 0; index < value.length; index += 1) {
    const key = String(index)
    if (!Object.hasOwn(descriptors, key)) throw invalidJson()
    allowedNames.add(key)
  }

  for (const name of Object.keys(descriptors)) {
    if (!allowedNames.has(name)) throw invalidJson()
  }

  ancestors.add(value)
  try {
    const entries: string[] = []
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)]
      if (descriptor === undefined || !("value" in descriptor)) throw invalidJson()
      entries.push(serializeValue(descriptor.value, depth + 1, ancestors))
    }
    return `[${entries.join(",")}]`
  } finally {
    ancestors.delete(value)
  }
}

function serializeObject(
  value: { readonly [key: string]: AuditJsonValue },
  depth: number,
  ancestors: WeakSet<object>,
): string {
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) throw invalidJson()

  const descriptors = assertNoAccessorsOrSymbols(value)
  const keys = Object.keys(value).sort(compareUnicodeCodePoints)

  ancestors.add(value)
  try {
    const entries = keys.map((key) => {
      const descriptor = descriptors[key]
      if (descriptor === undefined || !("value" in descriptor)) throw invalidJson()
      let serializedValue: string
      if (isSensitiveKey(key)) {
        // Redaction must not turn a cycle or unsupported runtime value into accepted JSON.
        serializeValue(descriptor.value, depth + 1, ancestors)
        serializedValue = JSON.stringify(redactedValue)
      } else {
        serializedValue = serializeValue(descriptor.value, depth + 1, ancestors)
      }

      return `${JSON.stringify(key)}:${serializedValue}`
    })
    return `{${entries.join(",")}}`
  } finally {
    ancestors.delete(value)
  }
}

function serializeValue(value: unknown, depth: number, ancestors: WeakSet<object>): string {
  if (depth > maximumAuditJsonDepth) throw invalidJson()

  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return serializePrimitive(value)
  }

  if (typeof value !== "object") throw invalidJson()
  if (ancestors.has(value)) throw invalidJson()

  if (Array.isArray(value)) {
    return serializeArray(value as ReadonlyArray<AuditJsonValue>, depth, ancestors)
  }

  return serializeObject(value as { readonly [key: string]: AuditJsonValue }, depth, ancestors)
}

/**
 * Converts an audit projection to canonical, redacted JSON for one SQL column.
 * Root null maps to SQL null; nested null remains JSON null.
 */
export function toStableAuditJson(value: AuditJsonValue): string | null {
  if (value === null) return null

  let serialized: string
  try {
    serialized = serializeValue(value, 0, new WeakSet())
  } catch (error) {
    if (error instanceof ValidationError || error instanceof PayloadTooLargeError) throw error
    throw invalidJson({ cause: error })
  }

  if (new TextEncoder().encode(serialized).byteLength > maximumAuditJsonBytes) {
    throw new PayloadTooLargeError("audit JSON exceeds the 64 KiB limit", "audit_payload_too_large")
  }

  return serialized
}
