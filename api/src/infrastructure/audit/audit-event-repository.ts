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
const EXPORT_DETAIL_WIRE_CHUNK_BYTES = 4 * 1024 * 1024
const DETAIL_TEXT_SEGMENT_BYTES = 256 * 1024

const SUMMARY_SELECT_COLUMNS = `
  id, event_id, request_id, actor_account_id, actor_employee_id, action,
  target_type, target_id, outcome, reason_code, client_name, created_at
`

const DETAIL_DATABASE_COLUMNS = [
  "id",
  "event_id",
  "request_id",
  "actor_account_id",
  "actor_employee_id",
  "action",
  "target_type",
  "target_id",
  "outcome",
  "reason_code",
  "authorization_json",
  "before_json",
  "after_json",
  "metadata_json",
  "client_ip",
  "client_name",
  "created_at",
] as const

const DETAIL_TEXT_COLUMNS = [
  "event_id",
  "request_id",
  "action",
  "target_type",
  "target_id",
  "outcome",
  "reason_code",
  "authorization_json",
  "before_json",
  "after_json",
  "metadata_json",
  "client_ip",
  "client_name",
] as const

type DetailTextColumn = (typeof DETAIL_TEXT_COLUMNS)[number]

const DETAIL_SELECT_COLUMNS = DETAIL_DATABASE_COLUMNS.join(", ")

// Object braces, commas, and `"column":` prefixes in JSON.stringify(D1Result.results).
// Deriving this from the projection keeps the wire estimate in sync when columns change.
const DETAIL_ROW_WIRE_FIXED_BYTES =
  2 +
  DETAIL_DATABASE_COLUMNS.reduce(
    (bytes, column, index) => bytes + column.length + 3 + (index === 0 ? 0 : 1),
    0,
  )

const DETAIL_WIRE_BYTES_SQL = `
  ${DETAIL_ROW_WIRE_FIXED_BYTES} +
  length(CAST(id AS BLOB)) +
  ${DETAIL_TEXT_COLUMNS.map((column) => `length(CAST(json_quote(${column}) AS BLOB))`).join(
    " +\n  ",
  )} +
  CASE WHEN actor_account_id IS NULL THEN 4
       ELSE length(CAST(actor_account_id AS BLOB)) END +
  CASE WHEN actor_employee_id IS NULL THEN 4
       ELSE length(CAST(actor_employee_id AS BLOB)) END +
  length(CAST(created_at AS BLOB))
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
  wire_bytes: z.number().int().safe().nonnegative(),
})

type AuditExportDescriptorRow = z.infer<typeof auditExportDescriptorRowSchema>

type AuditSegmentLayoutRow = {
  id: number
  actor_account_id: number | null
  actor_employee_id: number | null
  created_at: number
} & Record<`${DetailTextColumn}_bytes`, number | null>

const auditSegmentLayoutRowSchema = z.strictObject({
  id: z.number().int().safe(),
  actor_account_id: actorIdSchema,
  actor_employee_id: actorIdSchema,
  created_at: validIsoEpochSchema,
  ...Object.fromEntries(
    DETAIL_TEXT_COLUMNS.map((column) => [
      `${column}_bytes`,
      z.number().int().safe().nonnegative().nullable(),
    ]),
  ),
})

const auditTextSegmentRowSchema = z.strictObject({
  id: z.number().int().safe(),
  created_at: validIsoEpochSchema,
  chunk_hex: z.string(),
})

const SEGMENT_LAYOUT_SELECT_COLUMNS = [
  "id",
  "actor_account_id",
  "actor_employee_id",
  "created_at",
  ...DETAIL_TEXT_COLUMNS.map(
    (column) =>
      `CASE WHEN ${column} IS NULL THEN NULL ` +
      `ELSE length(CAST(${column} AS BLOB)) END AS ${column}_bytes`,
  ),
].join(", ")

const UPPER_HEX = /^(?:[0-9A-F]{2})*$/u
const FATAL_UTF8_DECODER = new TextDecoder("utf-8", { fatal: true })

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

function parseSegmentLayoutRow(result: unknown): AuditSegmentLayoutRow {
  const parsed = auditSegmentLayoutRowSchema.safeParse(result)
  if (!parsed.success) throw unavailable(parsed.error)

  return parsed.data as AuditSegmentLayoutRow
}

function parseTextSegmentRow(result: unknown): z.infer<typeof auditTextSegmentRowSchema> {
  const parsed = auditTextSegmentRowSchema.safeParse(result)
  if (!parsed.success) throw unavailable(parsed.error)

  return parsed.data
}

function decodeHexInto(
  chunkHex: string,
  expectedBytes: number,
  destination: Uint8Array,
  destinationOffset: number,
): void {
  if (chunkHex.length !== expectedBytes * 2 || !UPPER_HEX.test(chunkHex)) {
    throw unavailable(new Error("audit text segment is incomplete"))
  }

  for (let index = 0; index < expectedBytes; index += 1) {
    const byte = Number.parseInt(chunkHex.slice(index * 2, index * 2 + 2), 16)
    if (!Number.isInteger(byte)) throw unavailable(new Error("audit text segment is invalid"))
    destination[destinationOffset + index] = byte
  }
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
  wireByteBudget: number,
): { sql: string; bindings: ReadonlyArray<string | number> } {
  const limitIndex = parts.bindings.push(limit)
  const rawBudgetIndex = parts.bindings.push(rawByteBudget)
  const wireBudgetIndex = parts.bindings.push(wireByteBudget - 1)
  const where = parts.clauses.length === 0 ? "" : `WHERE ${parts.clauses.join(" AND ")}`

  return {
    sql: `WITH sized AS (
            SELECT id, created_at, (${DETAIL_RAW_BYTES_SQL}) AS raw_bytes,
                   (${DETAIL_WIRE_BYTES_SQL}) AS wire_bytes
            FROM audit_logs ${where}
            ORDER BY created_at DESC, id DESC
            LIMIT ?${limitIndex}
          ), bounded AS (
            SELECT id, created_at, raw_bytes, wire_bytes,
                   SUM(raw_bytes) OVER (
                     ORDER BY created_at DESC, id DESC ROWS UNBOUNDED PRECEDING
                   ) AS cumulative_raw_bytes,
                   SUM(wire_bytes + 1) OVER (
                     ORDER BY created_at DESC, id DESC ROWS UNBOUNDED PRECEDING
                   ) AS cumulative_wire_bytes,
                   ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) AS row_number
            FROM sized
          )
          SELECT id, created_at, raw_bytes, wire_bytes
          FROM bounded
          WHERE (cumulative_raw_bytes <= ?${rawBudgetIndex}
                 AND cumulative_wire_bytes <= ?${wireBudgetIndex})
             OR row_number = 1
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

  private async loadExactDetails(
    descriptors: ReadonlyArray<AuditExportDescriptorRow>,
  ): Promise<ReadonlyArray<AuditDetailDatabaseRow>> {
    const detailResult = await this.c.env.DB.prepare(
      `SELECT ${DETAIL_SELECT_COLUMNS}
       FROM audit_logs
       WHERE id IN (SELECT value FROM json_each(?1))
       ORDER BY created_at DESC, id DESC`,
    )
      .bind(detailIdsJson(descriptors))
      .all()
    if (!detailResult.success) throw new Error("audit detail query did not succeed")

    const rows = parseDetailRows(detailResult.results)
    if (
      rows.length !== descriptors.length ||
      rows.some(
        (row, index) =>
          row.id !== descriptors[index]?.id || row.created_at !== descriptors[index]?.created_at,
      )
    ) {
      throw new Error("audit detail rows changed during read")
    }

    return rows
  }

  private async loadSegmentedDetail(
    descriptor: AuditExportDescriptorRow,
  ): Promise<AuditDetailDatabaseRow> {
    const layoutResult = await this.c.env.DB.prepare(
      `SELECT ${SEGMENT_LAYOUT_SELECT_COLUMNS}
       FROM audit_logs WHERE id = ?1 LIMIT 1`,
    )
      .bind(descriptor.id)
      .all()
    if (!layoutResult.success || layoutResult.results.length !== 1) {
      throw new Error("audit segmented detail layout did not succeed")
    }

    const layout = parseSegmentLayoutRow(layoutResult.results[0])
    if (layout.id !== descriptor.id || layout.created_at !== descriptor.created_at) {
      throw new Error("audit segmented detail changed during read")
    }

    const rawBytes =
      (layout.actor_account_id === null ? 0 : String(layout.actor_account_id).length) +
      (layout.actor_employee_id === null ? 0 : String(layout.actor_employee_id).length) +
      String(layout.created_at).length +
      DETAIL_TEXT_COLUMNS.reduce((total, column) => total + (layout[`${column}_bytes`] ?? 0), 0)
    if (rawBytes !== descriptor.raw_bytes) {
      throw new Error("audit segmented detail size changed during read")
    }

    const text = {} as Record<DetailTextColumn, string | null>
    for (const column of DETAIL_TEXT_COLUMNS) {
      const byteLength = layout[`${column}_bytes`]
      if (byteLength === null) {
        text[column] = null
        continue
      }

      const bytes = new Uint8Array(byteLength)
      for (let offset = 0; offset < byteLength; offset += DETAIL_TEXT_SEGMENT_BYTES) {
        const expectedBytes = Math.min(DETAIL_TEXT_SEGMENT_BYTES, byteLength - offset)
        const segmentResult = await this.c.env.DB.prepare(
          `SELECT id, created_at,
                  hex(substr(CAST(${column} AS BLOB), ?2, ${DETAIL_TEXT_SEGMENT_BYTES})) AS chunk_hex
           FROM audit_logs WHERE id = ?1 LIMIT 1`,
        )
          .bind(descriptor.id, offset + 1)
          .all()
        if (!segmentResult.success || segmentResult.results.length !== 1) {
          throw new Error("audit text segment query did not succeed")
        }

        const segment = parseTextSegmentRow(segmentResult.results[0])
        if (segment.id !== descriptor.id || segment.created_at !== descriptor.created_at) {
          throw new Error("audit text segment changed during read")
        }
        decodeHexInto(segment.chunk_hex, expectedBytes, bytes, offset)
      }

      text[column] = FATAL_UTF8_DECODER.decode(bytes)
    }

    const rows = parseDetailRows([
      {
        id: layout.id,
        actor_account_id: layout.actor_account_id,
        actor_employee_id: layout.actor_employee_id,
        created_at: layout.created_at,
        ...text,
      },
    ])
    const row = rows[0]
    if (row === undefined) throw new Error("audit segmented detail is missing")

    return row
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
        `SELECT id, created_at, (${DETAIL_RAW_BYTES_SQL}) AS raw_bytes,
                (${DETAIL_WIRE_BYTES_SQL}) AS wire_bytes
         FROM audit_logs WHERE event_id = ?1 LIMIT 1`,
      )
        .bind(eventId)
        .all()
      if (!result.success) throw new Error("audit detail query did not succeed")

      const descriptor = parseExportDescriptorRows(result.results).at(0)
      if (descriptor === undefined) return null

      const row =
        descriptor.wire_bytes + 2 > EXPORT_DETAIL_WIRE_CHUNK_BYTES
          ? await this.loadSegmentedDetail(descriptor)
          : (await this.loadExactDetails([descriptor]))[0]
      if (row === undefined) throw new Error("audit detail row is missing")

      return toDetail(row)
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
          EXPORT_DETAIL_WIRE_CHUNK_BYTES,
        )
        const descriptorResult = await this.c.env.DB.prepare(descriptorStatement.sql)
          .bind(...descriptorStatement.bindings)
          .all()
        if (!descriptorResult.success) throw new Error("audit export size query did not succeed")

        const descriptors = parseExportDescriptorRows(descriptorResult.results)
        if (descriptors.length === 0) break
        if (descriptors.length > remainingRows) throw exportTooLarge()
        if ((descriptors[0]?.raw_bytes ?? 0) > sizeGuard.remainingBytes) throw exportTooLarge()

        const requiresSegmentedRead =
          (descriptors[0]?.wire_bytes ?? 0) + 2 > EXPORT_DETAIL_WIRE_CHUNK_BYTES
        let rows: ReadonlyArray<AuditDetailDatabaseRow>
        if (requiresSegmentedRead) {
          if (descriptors.length !== 1 || descriptors[0] === undefined) {
            throw new Error("audit export wire guard did not isolate a large row")
          }
          rows = [await this.loadSegmentedDetail(descriptors[0])]
        } else {
          rows = await this.loadExactDetails(descriptors)
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
