import { app } from "@/api/app"
import type { Bindings } from "@/env"
import { seedPepperSecret } from "@/contexts/company/infrastructure/seed/seed-password-hash"

export type Props = {
  db: D1Database
  jwtSecret: string
  path: string
  token: string | null
  method?: string
  body?: unknown
  now?: string
  headers?: Record<string, string>
  companyTimeZone?: string
  provisioningApiKey?: string
  identityJwks?: string
  identityIssuer?: string
  identityAudience?: string
  identityLoginUrl?: string
  apiOrigin?: string
  enabledOptionalFeatures?: string
  disabledStandardFeatures?: string
}

/**
 * テスト用の既定の固定時刻。created_at 等の検証はこの値を期待値にする。
 * 注意: 会計年度（toFiscalYear、4 月始まり）ではこの日付は 2025 年度になる。
 * fiscal year を参照するテストはシードと整合する now（例: 2026-06-01）を明示的に渡すこと。
 */
const defaultNow = "2026-01-01T00:00:00.000Z"

/**
 * テスト用: テスト DB と Bindings（secret と固定時刻）を渡して app を叩く。
 * リクエストスコープは Hono の contextStorage が確立する。
 */
export function requestWithContext(props: Props): Promise<Response> {
  const headers: Record<string, string> = { ...props.headers }

  if (props.token !== null) {
    headers.Authorization = `Bearer ${props.token}`
  }

  if (props.body !== undefined) {
    headers["content-type"] = "application/json"
  }

  const bindings: Bindings = {
    DB: props.db,
    JWT_SECRET: props.jwtSecret,
    PEPPER_SECRET: seedPepperSecret,
    AUDIT_HMAC_SECRET: "request-with-context-audit-hmac-secret",
    COMPANY_TIME_ZONE: props.companyTimeZone ?? "Asia/Tokyo",
    NOW: props.now ?? defaultNow,
    PROVISIONING_API_KEY: props.provisioningApiKey,
    IDENTITY_JWKS: props.identityJwks,
    IDENTITY_ISSUER: props.identityIssuer,
    IDENTITY_AUDIENCE: props.identityAudience,
    IDENTITY_LOGIN_URL: props.identityLoginUrl,
    API_ORIGIN: props.apiOrigin,
    // 既存の route テストは全機能有効を前提に書かれているため、テストの既定は "all" にする。
    // feature gate のテストだけが明示的に上書きする。
    ENABLED_OPTIONAL_FEATURES: props.enabledOptionalFeatures ?? "all",
    DISABLED_STANDARD_FEATURES: props.disabledStandardFeatures,
  }

  return Promise.resolve(
    app.request(
      props.path,
      {
        method: props.method ?? "GET",
        headers,
        body: props.body === undefined ? undefined : JSON.stringify(props.body),
      },
      bindings,
    ),
  )
}
