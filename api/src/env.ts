import type { Session } from "@/lib/auth/session"
import type { schema } from "@/schema"
import type { DrizzleD1Database } from "drizzle-orm/d1"

/** Workers のバインディング（wrangler の vars / secrets / D1）。 */
export type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  // 監査イベントの識別子 HMAC 用。`wrangler secret put AUDIT_HMAC_SECRET` で登録する。
  AUDIT_HMAC_SECRET: string
  // 人事上の会社営業日を求める IANA タイムゾーン。未設定・不正値は認証と人事変更を拒否する。
  COMPANY_TIME_ZONE?: string
  // CORS で許可する Origin をカンマ区切りで指定する（例: "https://app.example.com,https://admin.example.com"）。
  // 未設定時はローカル開発用 Origin のみ許可。本番では必ず設定する。
  CORS_ORIGIN?: string
  // テストで現在時刻を固定するための注入点（本番では未設定 = 実時計）。
  NOW?: string
  // ログインエンドポイントのレート制限カウンターを保持する KV namespace。
  // `wrangler kv:namespace create RATE_LIMIT` で発行し wrangler.jsonc に設定する。
  RATE_LIMIT?: KVNamespace
  // ログイン以外の全エンドポイントの IP 単位グローバルレート制限（Workers Rate Limiting binding）。
  // wrangler.jsonc の ratelimits で設定する。未設定（ローカル開発・テスト）ではスキップする。
  API_RATE_LIMITER?: RateLimit
  // プロビジョニング（外部 identity の同期）エンドポイント専用の machine API キー。
  // `wrangler secret put PROVISIONING_API_KEY` で登録する。未設定なら全リクエストを拒否する。
  PROVISIONING_API_KEY?: string
  // 外部 identity provider が発行する短命ログイントークン（HS256 JWT）の検証共有シークレット。
  // `wrangler secret put IDENTITY_JWT_SECRET` で登録する。未設定なら identity ログインを拒否する。
  IDENTITY_JWT_SECRET?: string
  // 外部 identity トークンに期待する iss（発行者）。未設定なら identity ログインを拒否する。
  IDENTITY_ISSUER?: string
  // 外部 identity トークンに期待する aud（想定受信者）。未設定時は "open-karte" を既定とする。
  IDENTITY_AUDIENCE?: string
  // 初期 ROOT 作成用。`wrangler secret put BOOTSTRAP_TOKEN` で登録し、初期化完了後は削除を推奨。
  // 未設定時は機能無効（POST /bootstrap は 404 を返す）。
  BOOTSTRAP_TOKEN?: string
  // CLI（ネイティブアプリ）ログインで、本人確認を委ねる外部 identity provider（ブローカー）のログイン URL。
  // GET /auth/cli/login はこの URL へ `?callback=<API_ORIGIN>/auth/cli/callback&state=...` を付けて 302 する。
  // 未設定なら CLI ログインを一律拒否する。
  IDENTITY_LOGIN_URL?: string
  // この API 自身の外部公開 origin（例: "https://api.example.com"）。
  // ブローカーへ渡す callback URL の組み立てと、identity トークンの audience 検証に使う。
  // 未設定なら CLI ログインを一律拒否する。
  API_ORIGIN?: string
}

export type RequestAuditContext = {
  requestId: string
  clientName: "web" | "cli" | "api" | "system"
  clientIp: string | null
  externalRequestId: string | null
}

/** リクエストスコープの変数。database に Drizzle、session に本人（Session。認可判定は session.hasPermission）を載せる。 */
export type Variables = {
  database: DrizzleD1Database<typeof schema>
  session: Session | null
  auditContext: RequestAuditContext
}

/** Hono の Env。new Hono<HonoEnv>() / createFactory<HonoEnv>() で使う。 */
export type HonoEnv = {
  Bindings: Bindings
  Variables: Variables
}

/** リポジトリ・ユースケースが受け取る Context の最小型。 */
export type Context = {
  var: Variables
  env: Bindings
}
