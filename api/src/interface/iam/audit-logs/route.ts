import { ListAuditLogs } from "@/application/iam/list-audit-logs"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppAuditLogList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"

// クエリ文字列を整数に丸める。未指定・非整数は null。
function toOptionalInt(raw: string | undefined): number | null {
  if (raw === undefined) {
    return null
  }

  const parsed = Number(raw)

  return Number.isInteger(parsed) ? parsed : null
}

// クエリ文字列を非空の文字列に整える。未指定・空文字は null。
function toOptionalString(raw: string | undefined): string | null {
  if (raw === undefined) {
    return null
  }

  const trimmed = raw.trim()

  return trimmed.length === 0 ? null : trimmed
}

// 日時クエリ（ISO 文字列 or epoch ミリ秒）を epoch ミリ秒に変換する。解釈できなければ null。
function toOptionalTimestamp(raw: string | undefined): number | null {
  if (raw === undefined) {
    return null
  }

  const trimmed = raw.trim()

  if (trimmed.length === 0) {
    return null
  }

  const asNumber = Number(trimmed)

  if (Number.isInteger(asNumber)) {
    return asNumber
  }

  const parsed = Date.parse(trimmed)

  return Number.isNaN(parsed) ? null : parsed
}

// GET /audit-logs — 監査ログ一覧（audit_log:read が必要）。新しい順・フィルタ・ページング付き
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const result = await new ListAuditLogs(c).run({
    session: session,
    actorAccountId: toOptionalInt(c.req.query("actor_account_id")),
    action: toOptionalString(c.req.query("action")),
    targetType: toOptionalString(c.req.query("target_type")),
    from: toOptionalTimestamp(c.req.query("from")),
    to: toOptionalTimestamp(c.req.query("to")),
    limit: limit,
    offset: offset,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  const responseBody = zAppAuditLogList.parse({
    data: result.entries.map((entry) => ({
      id: entry.id,
      actor_account_id: entry.actorAccountId,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      metadata: entry.metadata,
      ip: entry.ip,
      created_at: new Date(entry.createdAt).toISOString(),
    })),
    total: result.total,
  })

  return c.json(responseBody, 200)
})
