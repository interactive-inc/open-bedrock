import { createClient } from "@/lib/api/hc-client"

export type AuditLogFilter = {
  actorAccountId: number | null
  action: string | null
  targetType: string | null
  from: string | null
  to: string | null
}

type Params = {
  limit?: number
  offset?: number
}

// GET /audit-logs。監査ログ一覧を取得する。audit_log:read が無いと 403。
export async function getAuditLogs(filter: AuditLogFilter, params: Params = {}) {
  const client = await createClient()

  const response = await client["audit-logs"].$get({
    query: {
      actor_account_id: filter.actorAccountId !== null ? String(filter.actorAccountId) : undefined,
      action: filter.action ?? undefined,
      target_type: filter.targetType ?? undefined,
      from: filter.from ?? undefined,
      to: filter.to ?? undefined,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load audit logs")
  }

  return response.json()
}
