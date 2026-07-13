import type {
  AuditEventDetail,
  AuditEventRecord,
  AuditEventSummary,
  AuditOutcome,
} from "@/domain/audit/audit-event"
import { auditClientNameSchema, auditOutcomeSchema } from "@/domain/audit/audit-event"
import type { Context } from "@/env"
import { decodeAuditCursor, encodeAuditCursor } from "@/lib/audit/audit-cursor"
import type { AuditCursorPosition } from "@/lib/audit/audit-cursor"
import { AuditCsvByteCounter } from "@/lib/audit/audit-csv"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/batch-abort-guard"
import { PayloadTooLargeError, UnavailableError, ValidationError } from "@/lib/errors"
import { z } from "zod"

const SEARCH_MAX_LIMIT = 100
const EXPORT_MAX_ROWS = 50_000
const EXPORT_CHUNK_SIZE = 500
const EXPORT_DETAIL_RAW_CHUNK_BYTES = 4 * 1024 * 1024

const SUMMARY_SELECT_COLUMNS = `
  id, event_id, request_id, actor_account_id, actor_employee_id, action,
  target_type, target_id, outcome, reason_code, client_name, created_at
`

const DETAIL_SELECT_COLUMNS = `
  id, event_id, request_id, actor_account_id, actor_employee_id, action,
  target_type, target_id, outcome, reason_code, authorization_json,
  before_json, after_json, metadata_json, client_ip, client_name, created_at
`

const DETAIL_RAW_BYTES_SQL = `
  length(CAST(COALESCE(event_id, '') AS BLOB)) +
  length(CAST(COALESCE(request_id, '') AS BLOB)) +
  length(CAST(COALESCE(actor_account_id, '') AS BLOB)) +
  length(CAST(COALESCE(actor_employee_id, '') AS BLOB)) +
  length(CAST(COALESCE(action, '') AS BLOB)) +
  length(CAST(COALESCE(target_type, '') AS BLOB)) +
  length(CAST(COALESCE(target_id, '') AS BLOB)) +
  length(CAST(COALESCE(outcome, '') AS BLOB)) +
  length(CAST(COALESCE(reason_code, '') AS BLOB)) +
  length(CAST(COALESCE(authorization_json, '') AS BLOB)) +
  length(CAST(COALESCE(before_json, '') AS BLOB)) +
  length(CAST(COALESCE(after_json, '') AS BLOB)) +
  length(CAST(COALESCE(metadata_json, '') AS BLOB)) +
  length(CAST(COALESCE(client_ip, '') AS BLOB)) +
  length(CAST(COALESCE(client_name, '') AS BLOB)) +
  length(CAST(COALESCE(created_at, '') AS BLOB))
`

const validIsoEpochSchema = z
  .number()
  .int()
  .safe()
  .refine((value) => Number.isFinite(new Date(value * 1_000).getTime()))

const actorIdSchema = z.number().int().safe().nullable()

const auditSummaryDatabaseRowSchema = z.strictObject({
  id: z.number().int().safe(),
  event_id: z.string(),
  request_id: z.string(),
  actor_account_id: actorIdSchema,
  actor_employee_id: actorIdSchema,
  action: z.string(),
  target_type: z.string().nullable(),
  target_id: z.string().nullable(),
  outcome: auditOutcomeSchema,
  reason_code: z.string().nullable(),
  client_name: auditClientNameSchema,
  created_at: validIsoEpochSchema,
})

const auditDetailDatabaseRowSchema = auditSummaryDatabaseRowSchema.extend({
  authorization_json: z.string().nullable(),
  before_json: z.string().nullable(),
  after_json: z.string().nullable(),
  metadata_json: z.string().nullable(),
  client_ip: z.string().nullable(),
})

type AuditSummaryDatabaseRow = z.infer<typeof auditSummaryDatabaseRowSchema>
type AuditDetailDatabaseRow = z.infer<typeof auditDetailDatabaseRowSchema>

const auditExportDescriptorRowSchema = z.strictObject({
  id: z.number().int().safe(),
  created_at: validIsoEpochSchema,
  raw_bytes: z.number().int().safe().nonnegative(),
})

type AuditExportDescriptorRow = z.infer<typeof auditExportDescriptorRowSchema>

const auditFiltersSchema = z.strictObject({
  actorAccountId: z.number().int().safe().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  outcome: auditOutcomeSchema.optional(),
  fromEpoch: z.number().int().safe().optional(),
  toEpoch: z.number().int().safe().optional(),
})

const auditSearchQuerySchema = z.strictObject({
  limit: z.number().int().min(1).max(SEARCH_MAX_LIMIT),
  cursor: z.string().nullable(),
  filters: auditFiltersSchema,
})

const auditExportQuerySchema = z.strictObject({ filters: auditFiltersSchema })

export type AuditEventFilters = {
  actorAccountId?: number
  action?: string
  targetType?: string
  targetId?: string
  outcome?: AuditOutcome
  fromEpoch?: number
  toEpoch?: number
}

export type AuditEventSearchQuery = {
  limit: number
  cursor: string | null
  filters: AuditEventFilters
}

export type AuditEventExportQuery = { filters: AuditEventFilters }

export type AuditEventPage = {
  items: ReadonlyArray<AuditEventSummary>
  nextCursor: string | null
  previousCursor: string | null
}

function unavailable(cause: unknown): UnavailableError {
  return new UnavailableError("audit events are unavailable", "audit_unavailable", { cause })
}

function exportTooLarge(): PayloadTooLargeError {
  return new PayloadTooLargeError("audit export is too large", "audit_export_too_large")
}

function invalidQuery(cause: unknown): ValidationError {
  return new ValidationError("audit query is invalid", "audit_invalid_query", { cause })
}

function parseQuery<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    const parsed = schema.safeParse(value)
    if (!parsed.success) throw invalidQuery(parsed.error)

    return parsed.data
  } catch (error) {
    if (error instanceof ValidationError) throw error
    throw invalidQuery(error)
  }
}

function parseSummaryRows(results: ReadonlyArray<unknown>): ReadonlyArray<AuditSummaryDatabaseRow> {
  return results.map((row) => {
    const parsed = auditSummaryDatabaseRowSchema.safeParse(row)
    if (!parsed.success) throw unavailable(parsed.error)

    return parsed.data
  })
}

function parseDetailRows(results: ReadonlyArray<unknown>): ReadonlyArray<AuditDetailDatabaseRow> {
  return results.map((row) => {
    const parsed = auditDetailDatabaseRowSchema.safeParse(row)
    if (!parsed.success) throw unavailable(parsed.error)

    for (const json of [
      parsed.data.authorization_json,
      parsed.data.before_json,
      parsed.data.after_json,
      parsed.data.metadata_json,
    ]) {
      if (json === null) continue
      try {
        JSON.parse(json)
      } catch (error) {
        throw unavailable(error)
      }
    }

    return parsed.data
  })
}

function parseExportDescriptorRows(
  results: ReadonlyArray<unknown>,
): ReadonlyArray<AuditExportDescriptorRow> {
  return results.map((row) => {
    const parsed = auditExportDescriptorRowSchema.safeParse(row)
    if (!parsed.success) throw unavailable(parsed.error)

    return parsed.data
  })
}

function toSummary(row: AuditSummaryDatabaseRow): AuditEventSummary {
  return {
    eventId: row.event_id,
    requestId: row.request_id,
    actorAccountId: row.actor_account_id,
    actorEmployeeId: row.actor_employee_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    outcome: row.outcome,
    reasonCode: row.reason_code,
    clientName: row.client_name,
    createdAt: row.created_at,
  }
}

function toDetail(row: AuditDetailDatabaseRow): AuditEventDetail {
  return {
    ...toSummary(row),
    authorizationJson: row.authorization_json,
    beforeJson: row.before_json,
    afterJson: row.after_json,
    metadataJson: row.metadata_json,
    clientIp: row.client_ip,
  }
}

function cursorFor(
  row: AuditSummaryDatabaseRow,
  direction: AuditCursorPosition["direction"],
): string {
  return encodeAuditCursor({ version: 1, direction, createdAt: row.created_at, id: row.id })
}

type SqlParts = { clauses: string[]; bindings: Array<string | number> }

function addBoundClause(parts: SqlParts, column: string, operator: string, value: string | number) {
  parts.bindings.push(value)
  parts.clauses.push(`${column} ${operator} ?${parts.bindings.length}`)
}

function filterSql(filters: AuditEventFilters): SqlParts {
  const parts: SqlParts = { clauses: [], bindings: [] }

  if (filters.actorAccountId !== undefined) {
    addBoundClause(parts, "actor_account_id", "=", filters.actorAccountId)
  }
  if (filters.action !== undefined) addBoundClause(parts, "action", "=", filters.action)
  if (filters.targetType !== undefined) {
    addBoundClause(parts, "target_type", "=", filters.targetType)
  }
  if (filters.targetId !== undefined) addBoundClause(parts, "target_id", "=", filters.targetId)
  if (filters.outcome !== undefined) addBoundClause(parts, "outcome", "=", filters.outcome)
  if (filters.fromEpoch !== undefined) {
    addBoundClause(parts, "created_at", ">=", filters.fromEpoch)
  }
  if (filters.toEpoch !== undefined) addBoundClause(parts, "created_at", "<", filters.toEpoch)

  return parts
}

function addCursorClause(parts: SqlParts, cursor: AuditCursorPosition): void {
  const comparison = cursor.direction === "next" ? "<" : ">"
  const createdAtFirst = parts.bindings.push(cursor.createdAt)
  const createdAtSecond = parts.bindings.push(cursor.createdAt)
  const id = parts.bindings.push(cursor.id)
  parts.clauses.push(
    `(created_at ${comparison} ?${createdAtFirst} OR ` +
      `(created_at = ?${createdAtSecond} AND id ${comparison} ?${id}))`,
  )
}

function selectSql(
  parts: SqlParts,
  ascending: boolean,
  limit: number,
  columns: string,
): {
  sql: string
  bindings: ReadonlyArray<string | number>
} {
  const limitIndex = parts.bindings.push(limit)
  const where = parts.clauses.length === 0 ? "" : `WHERE ${parts.clauses.join(" AND ")}`
  const order = ascending ? "ASC" : "DESC"

  return {
    sql: `SELECT ${columns} FROM audit_logs ${where}
          ORDER BY created_at ${order}, id ${order} LIMIT ?${limitIndex}`,
    bindings: parts.bindings,
  }
}

function exportDescriptorSql(
  parts: SqlParts,
  limit: number,
  rawByteBudget: number,
): { sql: string; bindings: ReadonlyArray<string | number> } {
  const limitIndex = parts.bindings.push(limit)
  const budgetIndex = parts.bindings.push(rawByteBudget)
  const where = parts.clauses.length === 0 ? "" : `WHERE ${parts.clauses.join(" AND ")}`

  return {
    sql: `WITH sized AS (
            SELECT id, created_at, (${DETAIL_RAW_BYTES_SQL}) AS raw_bytes
            FROM audit_logs ${where}
            ORDER BY created_at DESC, id DESC
            LIMIT ?${limitIndex}
          ), bounded AS (
            SELECT id, created_at, raw_bytes,
                   SUM(raw_bytes) OVER (
                     ORDER BY created_at DESC, id DESC ROWS UNBOUNDED PRECEDING
                   ) AS cumulative_raw_bytes,
                   ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) AS row_number
            FROM sized
          )
          SELECT id, created_at, raw_bytes
          FROM bounded
          WHERE cumulative_raw_bytes <= ?${budgetIndex} OR row_number = 1
          ORDER BY created_at DESC, id DESC`,
    bindings: parts.bindings,
  }
}

function detailIdsJson(rows: ReadonlyArray<AuditExportDescriptorRow>): string {
  return JSON.stringify(rows.map((row) => row.id))
}

function rethrowRepositoryError(error: unknown): never {
  if (
    error instanceof ValidationError ||
    error instanceof PayloadTooLargeError ||
    error instanceof UnavailableError
  ) {
    throw error
  }

  throw unavailable(error)
}

export class AuditEventRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  private prepareInsert(record: AuditEventRecord): D1PreparedStatement {
    return this.c.env.DB.prepare(
      `INSERT INTO audit_logs
         (event_id, request_id, actor_account_id, actor_employee_id, action,
          target_type, target_id, outcome, reason_code, authorization_json,
          before_json, after_json, metadata_json, client_ip, client_name, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`,
    ).bind(
      record.eventId,
      record.requestId,
      record.actorAccountId,
      record.actorEmployeeId,
      record.action,
      record.targetType,
      record.targetId,
      record.outcome,
      record.reasonCode,
      record.authorizationJson,
      record.beforeJson,
      record.afterJson,
      record.metadataJson,
      record.clientIp,
      record.clientName,
      record.createdAt,
    )
  }

  /** Returns the audit INSERT and its mandatory changed-row guard as one batch fragment. */
  prepareAppend(record: AuditEventRecord): readonly [D1PreparedStatement, D1PreparedStatement] {
    return Object.freeze([
      this.prepareInsert(record),
      abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
    ] as const)
  }

  async append(record: AuditEventRecord): Promise<void> {
    try {
      const results = await this.c.env.DB.batch([...this.prepareAppend(record)])
      if (results.length !== 2 || results.some((result) => !result.success)) {
        throw new Error("audit append did not succeed")
      }
    } catch (error) {
      rethrowRepositoryError(error)
    }
  }

  async search(query: AuditEventSearchQuery): Promise<AuditEventPage> {
    const parsed = parseQuery(auditSearchQuerySchema, query)
    const cursor = parsed.cursor === null ? null : decodeAuditCursor(parsed.cursor)

    try {
      const parts = filterSql(parsed.filters)
      if (cursor !== null) addCursorClause(parts, cursor)
      const ascending = cursor?.direction === "previous"
      const statement = selectSql(parts, ascending, parsed.limit + 1, SUMMARY_SELECT_COLUMNS)
      const result = await this.c.env.DB.prepare(statement.sql)
        .bind(...statement.bindings)
        .all()
      if (!result.success) throw new Error("audit search did not succeed")

      const queried = parseSummaryRows(result.results)
      const hasMore = queried.length > parsed.limit
      const nearby = queried.slice(0, parsed.limit)
      const pageRows = ascending ? [...nearby].reverse() : nearby
      const first = pageRows.at(0)
      const last = pageRows.at(-1)

      if (first === undefined || last === undefined) {
        return { items: [], nextCursor: null, previousCursor: null }
      }

      return {
        items: pageRows.map(toSummary),
        nextCursor: cursor?.direction === "previous" || hasMore ? cursorFor(last, "next") : null,
        previousCursor:
          cursor?.direction === "next" || (cursor?.direction === "previous" && hasMore)
            ? cursorFor(first, "previous")
            : null,
      }
    } catch (error) {
      rethrowRepositoryError(error)
    }
  }

  async findByEventId(eventId: string): Promise<AuditEventDetail | null> {
    try {
      const result = await this.c.env.DB.prepare(
        `SELECT ${DETAIL_SELECT_COLUMNS} FROM audit_logs WHERE event_id = ?1 LIMIT 1`,
      )
        .bind(eventId)
        .all()
      if (!result.success) throw new Error("audit detail query did not succeed")

      const row = parseDetailRows(result.results).at(0)
      return row === undefined ? null : toDetail(row)
    } catch (error) {
      rethrowRepositoryError(error)
    }
  }

  async export(query: AuditEventExportQuery): Promise<ReadonlyArray<AuditEventDetail>> {
    const parsed = parseQuery(auditExportQuerySchema, query)

    try {
      const exported: AuditEventDetail[] = []
      const sizeGuard = new AuditCsvByteCounter()
      let position: AuditCursorPosition | null = null

      while (true) {
        const remainingRows = EXPORT_MAX_ROWS - exported.length
        const parts = filterSql(parsed.filters)
        if (position !== null) addCursorClause(parts, position)
        const descriptorStatement = exportDescriptorSql(
          parts,
          Math.min(EXPORT_CHUNK_SIZE, remainingRows + 1),
          Math.min(sizeGuard.remainingBytes, EXPORT_DETAIL_RAW_CHUNK_BYTES),
        )
        const descriptorResult = await this.c.env.DB.prepare(descriptorStatement.sql)
          .bind(...descriptorStatement.bindings)
          .all()
        if (!descriptorResult.success) throw new Error("audit export size query did not succeed")

        const descriptors = parseExportDescriptorRows(descriptorResult.results)
        if (descriptors.length === 0) break
        if (descriptors.length > remainingRows) throw exportTooLarge()
        if ((descriptors[0]?.raw_bytes ?? 0) > sizeGuard.remainingBytes) throw exportTooLarge()

        const detailResult = await this.c.env.DB.prepare(
          `SELECT ${DETAIL_SELECT_COLUMNS}
           FROM audit_logs
           WHERE id IN (SELECT value FROM json_each(?1))
           ORDER BY created_at DESC, id DESC`,
        )
          .bind(detailIdsJson(descriptors))
          .all()
        if (!detailResult.success) throw new Error("audit export detail query did not succeed")

        const rows = parseDetailRows(detailResult.results)
        if (
          rows.length !== descriptors.length ||
          rows.some(
            (row, index) =>
              row.id !== descriptors[index]?.id ||
              row.created_at !== descriptors[index]?.created_at,
          )
        ) {
          throw new Error("audit export rows changed during read")
        }
        for (const row of rows) {
          const detail = toDetail(row)
          sizeGuard.add(detail)
          exported.push(detail)
        }

        const last = descriptors.at(-1)
        if (last === undefined) break
        position = { version: 1, direction: "next", createdAt: last.created_at, id: last.id }
      }

      return exported
    } catch (error) {
      rethrowRepositoryError(error)
    }
  }
}
