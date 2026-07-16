import type { AuditExportRequest, AuditListQuery, AuditOutcome } from "@/lib/api/types/audit-types"
import { z } from "zod"

export type AuditSearchParams = Record<string, string | ReadonlyArray<string> | undefined>

export type AuditListQueryResult = { ok: true; query: AuditListQuery } | { ok: false }

const queryKeys = [
  "actor_account_id",
  "action",
  "target_type",
  "target_id",
  "outcome",
  "from",
  "to",
  "limit",
  "cursor",
] as const

const queryKeySet = new Set<string>(queryKeys)
const signedSafeIntegerPattern = /^(?:0|-?[1-9][0-9]*)$/u
const webLimitPattern = /^(?:[1-9]|[1-4][0-9]|50)$/u
const exactSecondIsoSchema = z.string().datetime({ offset: true, precision: 0 })
const outcomes = new Set<AuditOutcome>(["succeeded", "denied", "failed"])
const exportQueryKeys = [
  "actor_account_id",
  "action",
  "target_type",
  "target_id",
  "outcome",
  "from",
  "to",
] as const
const exportQueryKeySet = new Set<string>(exportQueryKeys)
const maximumExportRangeMilliseconds = 31 * 24 * 60 * 60 * 1_000

function exactSecondEpoch(value: string): number | null {
  if (!exactSecondIsoSchema.safeParse(value).success) return null
  const epoch = Date.parse(value)
  return Number.isFinite(epoch) && Number.isSafeInteger(epoch / 1_000) ? epoch : null
}

function isCanonicalSafeInteger(value: string): boolean {
  return signedSafeIntegerPattern.test(value) && Number.isSafeInteger(Number(value))
}

/** Strictly parses the Next.js URL state without collapsing repeated values. */
export function parseAuditListSearchParams(input: AuditSearchParams): AuditListQueryResult {
  for (const key of Object.keys(input)) {
    if (!queryKeySet.has(key)) return { ok: false }
  }

  const values = new Map<string, string>()
  for (const key of queryKeys) {
    const rawValue = input[key]
    if (rawValue !== undefined && typeof rawValue !== "string") return { ok: false }
    if (rawValue !== undefined && rawValue !== "") values.set(key, rawValue)
  }

  const actorAccountId = values.get("actor_account_id")
  if (actorAccountId !== undefined && !isCanonicalSafeInteger(actorAccountId)) {
    return { ok: false }
  }

  const action = values.get("action")
  if (action !== undefined && action.length > 200) return { ok: false }
  const targetType = values.get("target_type")
  if (targetType !== undefined && targetType.length > 200) return { ok: false }
  const targetId = values.get("target_id")
  if (targetId !== undefined && targetId.length > 512) return { ok: false }

  const outcome = values.get("outcome")
  if (outcome !== undefined && !outcomes.has(outcome as AuditOutcome)) return { ok: false }

  const from = values.get("from")
  const to = values.get("to")
  const fromEpoch = from === undefined ? undefined : exactSecondEpoch(from)
  const toEpoch = to === undefined ? undefined : exactSecondEpoch(to)
  if (fromEpoch === null || toEpoch === null) return { ok: false }
  if (fromEpoch !== undefined && toEpoch !== undefined && fromEpoch >= toEpoch) {
    return { ok: false }
  }

  const limit = values.get("limit") ?? "50"
  if (!webLimitPattern.test(limit)) return { ok: false }
  const cursor = values.get("cursor")
  if (cursor !== undefined && cursor.length > 256) return { ok: false }

  const query: AuditListQuery = { limit }
  if (actorAccountId !== undefined) query.actor_account_id = actorAccountId
  if (action !== undefined) query.action = action
  if (targetType !== undefined) query.target_type = targetType
  if (targetId !== undefined) query.target_id = targetId
  if (outcome !== undefined) query.outcome = outcome as AuditOutcome
  if (from !== undefined) query.from = from
  if (to !== undefined) query.to = to
  if (cursor !== undefined) query.cursor = cursor

  return { ok: true, query }
}

/** Builds one canonical audit list URL while treating cursor as an opaque value. */
export function buildAuditEventsHref(query: AuditListQuery, cursor: string | null): string {
  const params = new URLSearchParams()
  for (const key of queryKeys) {
    if (key === "cursor") continue
    const value = query[key]
    if (value !== undefined) params.set(key, value)
  }
  if (cursor !== null) params.set("cursor", cursor)
  const suffix = params.toString()
  return suffix === "" ? "/admin/audit-events" : `/admin/audit-events?${suffix}`
}

export type AuditExportQueryResult =
  | { ok: true; request: AuditExportRequest }
  | { ok: false; field: "from" | "to" | "form"; message: string }

function normalizeExportInput(input: AuditSearchParams | URLSearchParams): AuditSearchParams {
  if (!(input instanceof URLSearchParams)) return input
  const normalized: AuditSearchParams = {}
  for (const key of new Set(input.keys())) {
    const values = input.getAll(key)
    normalized[key] = values.length === 1 ? values[0] : values
  }
  return normalized
}

/** Strictly validates the local CSV query and returns the typed API POST body. */
export function parseAuditExportSearchParams(
  source: AuditSearchParams | URLSearchParams,
): AuditExportQueryResult {
  const input = normalizeExportInput(source)
  for (const key of Object.keys(input)) {
    if (!exportQueryKeySet.has(key)) {
      return { ok: false, field: "form", message: "出力条件が無効です。" }
    }
  }

  const values = new Map<string, string>()
  for (const key of exportQueryKeys) {
    const rawValue = input[key]
    if (rawValue !== undefined && typeof rawValue !== "string") {
      return { ok: false, field: "form", message: "出力条件が無効です。" }
    }
    if (rawValue !== undefined && rawValue !== "") values.set(key, rawValue)
  }

  const actorAccountId = values.get("actor_account_id")
  if (actorAccountId !== undefined && !isCanonicalSafeInteger(actorAccountId)) {
    return { ok: false, field: "form", message: "実行アカウントIDが無効です。" }
  }

  const action = values.get("action")
  const targetType = values.get("target_type")
  const targetId = values.get("target_id")
  if (
    (action !== undefined && action.length > 200) ||
    (targetType !== undefined && targetType.length > 200) ||
    (targetId !== undefined && targetId.length > 512)
  ) {
    return { ok: false, field: "form", message: "出力条件が長すぎます。" }
  }

  const outcome = values.get("outcome")
  if (outcome !== undefined && !outcomes.has(outcome as AuditOutcome)) {
    return { ok: false, field: "form", message: "結果の指定が無効です。" }
  }

  const from = values.get("from")
  if (from === undefined) {
    return { ok: false, field: "from", message: "開始日時を入力してください。" }
  }
  const fromEpoch = exactSecondEpoch(from)
  if (fromEpoch === null) {
    return { ok: false, field: "from", message: "開始日時をオフセット付き形式で入力してください。" }
  }

  const to = values.get("to")
  if (to === undefined) {
    return { ok: false, field: "to", message: "終了日時を入力してください。" }
  }
  const toEpoch = exactSecondEpoch(to)
  if (toEpoch === null) {
    return { ok: false, field: "to", message: "終了日時をオフセット付き形式で入力してください。" }
  }
  if (fromEpoch >= toEpoch) {
    return { ok: false, field: "to", message: "終了日時は開始日時より後にしてください。" }
  }
  if (toEpoch - fromEpoch > maximumExportRangeMilliseconds) {
    return { ok: false, field: "to", message: "出力期間は31日以内にしてください。" }
  }

  const request: AuditExportRequest = { from, to }
  if (actorAccountId !== undefined) request.actor_account_id = Number(actorAccountId)
  if (action !== undefined) request.action = action
  if (targetType !== undefined) request.target_type = targetType
  if (targetId !== undefined) request.target_id = targetId
  if (outcome !== undefined) request.outcome = outcome as AuditOutcome
  return { ok: true, request }
}
