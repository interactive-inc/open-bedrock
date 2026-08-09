import { SystemAuditJsonError } from "@/domain/system/audit/system-audit-json-error"
import type { SystemAuditJsonValue } from "@/domain/system/audit/system-audit-json-value"

const maximumAuditJsonBytes = 65_536
const maximumAuditJsonDepth = 100
const maximumAuditValidationWorkUnits = 100_000
const maximumArrayLength = 0xffff_ffff
const redactedValue = "[REDACTED]"
const exactSensitiveKeys = new Set([
  "apikey",
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "setcookie",
  "privatekey",
  "clientsecret",
])

type SnapshotEntry = {
  key: string
  value: unknown
  sensitive: boolean
}

type DataPropertySnapshot = {
  configurable: boolean | undefined
  enumerable: boolean | undefined
  value: unknown
  writable: boolean | undefined
}

type AuditJsonObjectSnapshot = {
  kind: "object"
  entries: ReadonlyArray<SnapshotEntry>
  sortedEntries?: ReadonlyArray<SnapshotEntry>
}

type AuditJsonSnapshot = { kind: "array"; values: ReadonlyArray<unknown> } | AuditJsonObjectSnapshot

type ValidationState = {
  snapshots: WeakMap<object, AuditJsonSnapshot>
  heights: WeakMap<object, number>
  visiting: WeakSet<object>
  workUnits: number
}

const textEncoder = new TextEncoder()

function invalidJson(options?: ErrorOptions): SystemAuditJsonError {
  return new SystemAuditJsonError("invalid_json", options)
}

function payloadTooLarge(): SystemAuditJsonError {
  return new SystemAuditJsonError("payload_too_large")
}

function consumeValidationWork(state: ValidationState, units = 1): void {
  state.workUnits += units
  if (state.workUnits > maximumAuditValidationWorkUnits) throw payloadTooLarge()
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replaceAll(/[_-]/g, "")

  return (
    exactSensitiveKeys.has(normalized) ||
    normalized.startsWith("password") ||
    normalized.endsWith("password") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("token")
  )
}

function toUnicodeCodePoints(value: string): ReadonlyArray<number> {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0)
    if (codePoint === undefined) throw invalidJson()

    return codePoint
  })
}

function compareUnicodeCodePoints(left: string, right: string): number {
  const leftPoints = toUnicodeCodePoints(left)
  const rightPoints = toUnicodeCodePoints(right)
  const sharedLength = Math.min(leftPoints.length, rightPoints.length)

  for (let index = 0; index < sharedLength; index += 1) {
    const leftPoint = leftPoints[index]
    const rightPoint = rightPoints[index]
    if (leftPoint === undefined || rightPoint === undefined) throw invalidJson()

    const difference = leftPoint - rightPoint
    if (difference !== 0) return difference
  }

  return leftPoints.length - rightPoints.length
}

function getDataDescriptor(descriptors: PropertyDescriptorMap, key: string): DataPropertySnapshot {
  const descriptor = descriptors[key]
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    descriptor.get !== undefined ||
    descriptor.set !== undefined
  ) {
    throw invalidJson()
  }

  return {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    value: descriptor.value,
    writable: descriptor.writable,
  }
}

function getArrayLength(descriptors: PropertyDescriptorMap): number {
  const descriptor = getDataDescriptor(descriptors, "length")
  if (
    typeof descriptor.value !== "number" ||
    !Number.isSafeInteger(descriptor.value) ||
    descriptor.value < 0 ||
    descriptor.value > maximumArrayLength ||
    typeof descriptor.writable !== "boolean" ||
    descriptor.enumerable !== false ||
    descriptor.configurable !== false
  ) {
    throw invalidJson()
  }

  return descriptor.value
}

function toArrayIndex(key: string, length: number): number {
  const index = Number(key)
  if (!Number.isInteger(index) || index < 0 || index >= length || String(index) !== key) {
    throw invalidJson()
  }

  return index
}

function captureSnapshot(value: object, state: ValidationState): AuditJsonSnapshot {
  const cached = state.snapshots.get(value)
  if (cached !== undefined) return cached

  const isArray = Array.isArray(value)
  if (!isArray) {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) throw invalidJson()
  }

  // This is the only property snapshot. All symbol, accessor, enumerability, array-shape,
  // validation, and serialization decisions below are made from this immutable map.
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const ownKeys = Reflect.ownKeys(descriptors)
  consumeValidationWork(state, ownKeys.length)

  const descriptorKeys: string[] = []
  for (const key of ownKeys) {
    if (typeof key === "symbol") throw invalidJson()
    getDataDescriptor(descriptors, key)
    descriptorKeys.push(key)
  }

  let snapshot: AuditJsonSnapshot
  if (isArray) {
    const length = getArrayLength(descriptors)
    if (descriptorKeys.length !== length + 1) throw invalidJson()

    const values: unknown[] = Array.from({ length })
    for (const key of descriptorKeys) {
      if (key === "length") continue
      const index = toArrayIndex(key, length)
      values[index] = getDataDescriptor(descriptors, key).value
    }
    snapshot = { kind: "array", values }
  } else {
    const entries: SnapshotEntry[] = []
    for (const key of descriptorKeys) {
      const descriptor = getDataDescriptor(descriptors, key)
      if (descriptor.enumerable !== true) continue
      entries.push({
        key,
        value: descriptor.value,
        sensitive: isSensitiveKey(key),
      })
    }
    snapshot = { kind: "object", entries }
  }

  state.snapshots.set(value, snapshot)
  return snapshot
}

function validateValue(value: unknown, depth: number, state: ValidationState): number {
  consumeValidationWork(state)
  if (depth > maximumAuditJsonDepth) throw invalidJson()

  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return 0
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalidJson()
    return 0
  }
  if (typeof value !== "object") throw invalidJson()

  if (state.visiting.has(value)) throw invalidJson()
  const cachedHeight = state.heights.get(value)
  if (cachedHeight !== undefined) {
    if (depth + cachedHeight > maximumAuditJsonDepth) throw invalidJson()
    return cachedHeight
  }

  const snapshot = captureSnapshot(value, state)
  state.visiting.add(value)
  try {
    let height = 0
    if (snapshot.kind === "array") {
      for (const childValue of snapshot.values) {
        const childHeight = validateValue(childValue, depth + 1, state)
        height = Math.max(height, childHeight + 1)
      }
    } else {
      for (const entry of snapshot.entries) {
        const childHeight = validateValue(entry.value, depth + 1, state)
        height = Math.max(height, childHeight + 1)
      }
    }
    if (depth + height > maximumAuditJsonDepth) throw invalidJson()

    state.heights.set(value, height)
    return height
  } finally {
    state.visiting.delete(value)
  }
}

class AuditJsonWriter {
  readonly #chunks: string[] = []
  #byteLength = 0

  get remainingBytes(): number {
    return maximumAuditJsonBytes - this.#byteLength
  }

  write(chunk: string): void {
    // UTF-16 length is a safe lower bound for UTF-8 bytes. Check it before
    // allocating an encoded copy, especially for a single oversized string.
    if (chunk.length > this.remainingBytes) throw payloadTooLarge()

    const chunkBytes = textEncoder.encode(chunk).byteLength
    if (chunkBytes > this.remainingBytes) throw payloadTooLarge()

    this.#chunks.push(chunk)
    this.#byteLength += chunkBytes
  }

  writeJsonString(value: string): void {
    if (value.length + 2 > this.remainingBytes) throw payloadTooLarge()
    this.write(JSON.stringify(value))
  }

  toString(): string {
    return this.#chunks.join("")
  }
}

function getSortedEntries(
  snapshot: AuditJsonObjectSnapshot,
  remainingBytes: number,
): ReadonlyArray<SnapshotEntry> {
  // For a non-empty object, braces/commas/colons/quotes and the shortest JSON
  // value require at least five bytes per key plus one. UTF-16 key length is a
  // lower bound for its encoded/escaped bytes. Reject before an avoidable sort.
  let minimumBytes = snapshot.entries.length === 0 ? 2 : 1
  for (const entry of snapshot.entries) {
    minimumBytes += entry.key.length + 5
    if (minimumBytes > remainingBytes) throw payloadTooLarge()
  }

  if (snapshot.sortedEntries === undefined) {
    snapshot.sortedEntries = snapshot.entries
      .slice()
      .sort((left, right) => compareUnicodeCodePoints(left.key, right.key))
  }
  return snapshot.sortedEntries
}

function serializeValue(value: unknown, state: ValidationState, writer: AuditJsonWriter): void {
  if (value === null) {
    writer.write("null")
    return
  }
  if (typeof value === "boolean" || typeof value === "number") {
    writer.write(JSON.stringify(value))
    return
  }
  if (typeof value === "string") {
    writer.writeJsonString(value)
    return
  }
  if (typeof value !== "object") throw invalidJson()

  const snapshot = state.snapshots.get(value)
  if (snapshot === undefined) throw invalidJson()

  if (snapshot.kind === "array") {
    writer.write("[")
    for (let index = 0; index < snapshot.values.length; index += 1) {
      if (index > 0) writer.write(",")
      serializeValue(snapshot.values[index], state, writer)
    }
    writer.write("]")
    return
  }

  const entries = getSortedEntries(snapshot, writer.remainingBytes)
  writer.write("{")
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    if (entry === undefined) throw invalidJson()
    if (index > 0) writer.write(",")
    writer.writeJsonString(entry.key)
    writer.write(":")
    if (entry.sensitive) {
      writer.writeJsonString(redactedValue)
    } else {
      serializeValue(entry.value, state, writer)
    }
  }
  writer.write("}")
}

/**
 * Converts an audit projection to canonical, redacted JSON for one SQL column.
 * Root null maps to SQL null; nested null remains JSON null.
 */
export function toStableSystemAuditJson(
  value: SystemAuditJsonValue,
): string | null | SystemAuditJsonError {
  if (value === null) return null

  try {
    const state: ValidationState = {
      snapshots: new WeakMap(),
      heights: new WeakMap(),
      visiting: new WeakSet(),
      workUnits: 0,
    }
    validateValue(value, 0, state)

    const writer = new AuditJsonWriter()
    serializeValue(value, state, writer)
    return writer.toString()
  } catch (error) {
    return error instanceof SystemAuditJsonError ? error : invalidJson({ cause: error })
  }
}
