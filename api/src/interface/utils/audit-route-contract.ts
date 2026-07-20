import type { AuditEventDetail, AuditEventSummary } from "@/domain/audit/audit-event"
import type {
  AuditEventFilters,
  AuditEventPage,
} from "@/infrastructure/audit/audit-event-repository"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { AUDIT_CURSOR_MAX_LENGTH } from "@/lib/audit/audit-cursor"
import { toStableAuditJson } from "@/lib/audit/stable-json"
import { ApplicationError, NotFoundError, UnavailableError, ValidationError } from "@/lib/errors"
import { zAppAuditEventDetail, zAppAuditEventPage, zAppAuditEventSummary } from "@/lib/app-schemas"
import type {
  AppAuditEventDetail,
  AppAuditEventPage,
  AppAuditEventSummary,
} from "@/lib/app-schemas"
import { z } from "zod"

const FILTER_HASH_PREFIX = "open-karte:audit:filters:v1\0"
const EXPORT_BODY_MAX_BYTES = 16_384
const EXPORT_MAX_RANGE_SECONDS = 2_678_400
const EVENT_ID_MAX_LENGTH = 64
const EVENT_ID_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|legacy-(?:0|[1-9][0-9]*|-[1-9][0-9]*))$/u
const SIGNED_DECIMAL_PATTERN = /^(?:0|-?[1-9][0-9]*)$/u
const LIMIT_PATTERN = /^(?:[1-9]|[1-9][0-9]|100)$/u
const LIST_QUERY_KEYS = new Set([
  "actor_account_id",
  "action",
  "target_type",
  "target_id",
  "outcome",
  "from",
  "to",
  "limit",
  "cursor",
])

const exactSecondIsoSchema = z.string().datetime({ offset: true, precision: 0 })
const outcomeSchema = z.enum(["succeeded", "denied", "failed"])
const exportRangeSchema = z.strictObject({
  actor_account_id: z.number().int().safe().optional(),
  action: z.string().min(1).max(200).optional(),
  target_type: z.string().min(1).max(200).optional(),
  target_id: z.string().max(512).optional(),
  outcome: outcomeSchema.optional(),
  from: z.string(),
  to: z.string(),
})

export type ParsedAuditListQuery = {
  limit: number
  cursor: string | null
  filters: AuditEventFilters
}

export type ParsedAuditExportRange = { filters: AuditEventFilters }

export function auditUnavailable(cause?: unknown): UnavailableError {
  return new UnavailableError("audit events are unavailable", "audit_unavailable", { cause })
}

function invalidQuery(cause?: unknown): ValidationError {
  return new ValidationError("audit query is invalid", "audit_invalid_query", { cause })
}

function invalidExportRange(cause?: unknown): ValidationError {
  return new ValidationError("audit export range is invalid", "audit_invalid_export_range", {
    cause,
  })
}

export function auditEventNotFound(): NotFoundError {
  return new NotFoundError("audit event was not found", "audit_event_not_found")
}

function parseExactSecond(value: string): number {
  const parsed = exactSecondIsoSchema.safeParse(value)
  if (!parsed.success) throw new Error("timestamp shape is invalid")

  const milliseconds = Date.parse(parsed.data)
  const seconds = milliseconds / 1_000
  if (!Number.isFinite(milliseconds) || !Number.isSafeInteger(seconds)) {
    throw new Error("timestamp is outside the supported range")
  }

  return seconds
}

function parseSignedSafeInteger(value: string): number {
  if (!SIGNED_DECIMAL_PATTERN.test(value)) throw new Error("integer is not canonical")
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) throw new Error("integer is outside the safe range")
  return parsed
}

function optionalBoundedString(
  values: ReadonlyMap<string, string>,
  key: string,
  maximum: number,
  allowEmpty: boolean,
): string | undefined {
  const value = values.get(key)
  if (value === undefined) return undefined
  if ((!allowEmpty && value.length === 0) || value.length > maximum) {
    throw new Error(`${key} is outside its length bound`)
  }
  return value
}

/** Parses one strict list URL without collapsing duplicate or decoded query names. */
export function parseAuditListQuery(input: string): ParsedAuditListQuery {
  try {
    const url = new URL(input)
    const values = new Map<string, string>()
    for (const [key, value] of url.searchParams) {
      if (!LIST_QUERY_KEYS.has(key) || values.has(key)) {
        throw new Error("audit query contains an unknown or repeated key")
      }
      values.set(key, value)
    }

    const filters: AuditEventFilters = {}
    const actorAccountId = values.get("actor_account_id")
    if (actorAccountId !== undefined) {
      filters.actorAccountId = parseSignedSafeInteger(actorAccountId)
    }
    const action = optionalBoundedString(values, "action", 200, false)
    if (action !== undefined) filters.action = action
    const targetType = optionalBoundedString(values, "target_type", 200, false)
    if (targetType !== undefined) filters.targetType = targetType
    const targetId = optionalBoundedString(values, "target_id", 512, true)
    if (targetId !== undefined) filters.targetId = targetId
    const outcome = values.get("outcome")
    if (outcome !== undefined) filters.outcome = outcomeSchema.parse(outcome)
    const from = values.get("from")
    if (from !== undefined) filters.fromEpoch = parseExactSecond(from)
    const to = values.get("to")
    if (to !== undefined) filters.toEpoch = parseExactSecond(to)
    if (
      filters.fromEpoch !== undefined &&
      filters.toEpoch !== undefined &&
      filters.fromEpoch >= filters.toEpoch
    ) {
      throw new Error("audit range is empty or reversed")
    }

    const rawLimit = values.get("limit")
    if (rawLimit !== undefined && !LIMIT_PATTERN.test(rawLimit)) {
      throw new Error("audit limit is not canonical")
    }
    const limit = rawLimit === undefined ? 50 : Number(rawLimit)
    const cursor = values.get("cursor")
    if (cursor !== undefined && cursor.length > AUDIT_CURSOR_MAX_LENGTH) {
      throw new Error("audit cursor is outside its length bound")
    }

    return { limit, cursor: cursor ?? null, filters }
  } catch (error) {
    throw invalidQuery(error)
  }
}

/** Parses the strict JSON filter and enforces the exact-second, half-open 31-day range. */
export function parseAuditExportRange(input: unknown): ParsedAuditExportRange {
  try {
    const parsed = exportRangeSchema.parse(input)
    const fromEpoch = parseExactSecond(parsed.from)
    const toEpoch = parseExactSecond(parsed.to)
    if (fromEpoch >= toEpoch || toEpoch - fromEpoch > EXPORT_MAX_RANGE_SECONDS) {
      throw new Error("audit export range is empty, reversed, or too wide")
    }

    const filters: AuditEventFilters = { fromEpoch, toEpoch }
    if (parsed.actor_account_id !== undefined) filters.actorAccountId = parsed.actor_account_id
    if (parsed.action !== undefined) filters.action = parsed.action
    if (parsed.target_type !== undefined) filters.targetType = parsed.target_type
    if (parsed.target_id !== undefined) filters.targetId = parsed.target_id
    if (parsed.outcome !== undefined) filters.outcome = parsed.outcome
    return { filters }
  } catch (error) {
    throw invalidExportRange(error)
  }
}

/** Validates the path without reflecting malformed input into an error or audit record. */
export function parseAuditEventId(value: string | undefined): string {
  if (value === undefined || value.length > EVENT_ID_MAX_LENGTH || !EVENT_ID_PATTERN.test(value)) {
    throw auditEventNotFound()
  }
  return value
}

/** Converts a repository Unix-second timestamp into the public UTC representation. */
export function toAuditIsoString(epoch: number): string {
  try {
    if (!Number.isSafeInteger(epoch)) throw new Error("audit epoch is not a safe integer")
    const date = new Date(epoch * 1_000)
    if (!Number.isFinite(date.getTime())) throw new Error("audit epoch cannot be represented")
    return date.toISOString()
  } catch (error) {
    throw auditUnavailable(error)
  }
}

/** Resolves the injected clock and rejects invalid dates before event generation. */
export function resolveAuditNow(value: string | undefined): Date {
  const date = value === undefined ? new Date() : new Date(value)
  if (!Number.isFinite(date.getTime())) throw auditUnavailable(new Error("audit clock is invalid"))
  return date
}

/** Hashes only normalized filter values, excluding cursor, limit and raw input spellings. */
export async function hashAuditFilters(filters: AuditEventFilters): Promise<string> {
  try {
    const normalized = {
      actor_account_id: filters.actorAccountId ?? null,
      action: filters.action ?? null,
      target_type: filters.targetType ?? null,
      target_id: filters.targetId ?? null,
      outcome: filters.outcome ?? null,
      from_epoch: filters.fromEpoch ?? null,
      to_epoch: filters.toEpoch ?? null,
    }
    const bytes = new TextEncoder().encode(`${FILTER_HASH_PREFIX}${toStableAuditJson(normalized)}`)
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")
  } catch (error) {
    throw auditUnavailable(error)
  }
}

/** Reads and buffers no more than the route-local 16 KiB JSON body budget. */
export async function readBoundedAuditExportJson(request: Request): Promise<unknown> {
  try {
    const reader = request.body?.getReader()
    if (reader === undefined) throw new Error("audit export body is missing")
    const chunks: Uint8Array[] = []
    let byteLength = 0

    while (true) {
      const part = await reader.read()
      if (part.done) break
      byteLength += part.value.byteLength
      if (byteLength > EXPORT_BODY_MAX_BYTES) {
        await reader.cancel().catch(() => undefined)
        throw new Error("audit export body is too large")
      }
      chunks.push(part.value)
    }

    const body = new Uint8Array(byteLength)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body)
    return JSON.parse(text) as unknown
  } catch (error) {
    throw invalidExportRange(error)
  }
}

function projectSummary(item: AuditEventSummary): AppAuditEventSummary {
  return zAppAuditEventSummary.parse({
    event_id: item.eventId,
    request_id: item.requestId,
    actor_account_id: item.actorAccountId,
    actor_employee_id: item.actorEmployeeId,
    action: item.action,
    target_type: item.targetType,
    target_id: item.targetId,
    outcome: item.outcome,
    reason_code: item.reasonCode,
    client_name: item.clientName,
    created_at: toAuditIsoString(item.createdAt),
  })
}

export function toPublicAuditPage(page: AuditEventPage): AppAuditEventPage {
  try {
    return zAppAuditEventPage.parse({
      data: page.items.map(projectSummary),
      next_cursor: page.nextCursor,
      previous_cursor: page.previousCursor,
    })
  } catch (error) {
    throw auditUnavailable(error)
  }
}

export function toPublicAuditDetail(item: AuditEventDetail): AppAuditEventDetail {
  try {
    return zAppAuditEventDetail.parse({
      ...projectSummary(item),
      authorization_json: item.authorizationJson,
      before_json: item.beforeJson,
      after_json: item.afterJson,
      metadata_json: item.metadataJson,
      client_ip: item.clientIp,
    })
  } catch (error) {
    throw auditUnavailable(error)
  }
}

/** Converts all route-boundary application errors while hiding non-application causes. */
export function throwAuditRouteError(error: unknown): never {
  if (error instanceof ApplicationError) throw toHttpException(error)
  throw toHttpException(auditUnavailable(error))
}
