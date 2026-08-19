import type { Session } from "@/contexts/company/domain/iam/session"
import type { CompanyActor } from "@/contexts/company/application/core/company-actor"
import type { schema } from "@/schema"
import type {
  SystemD1Context,
  SystemDatabaseContext,
  SystemEmailSender,
  SystemRequestAudit,
  SystemRequestAuditContext,
} from "@system/infrastructure/configuration/system-context"
import type { OidcClientRegistry } from "@system/domain/identity/oidc-client.policy"
import type { OidcIssuerConfiguration } from "@system/domain/identity/oidc.value"
import type { DrizzleD1Database } from "drizzle-orm/d1"

/** Workers のバインディング（wrangler の vars / secrets / D1）。 */
export type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  OIDC_SIGNING_KEYS?: string
  PEPPER_SECRET?: string
  EMAIL?: SystemEmailSender
  EMAIL_SENDER_NAME?: string
  INVITE_EMAIL_FROM?: string
  INVITE_EMAIL_SEND_ENABLED?: string
  OIDC_CLIENT_REGISTRY?: OidcClientRegistry
  OIDC_ISSUER_CONFIGURATION?: OidcIssuerConfiguration
  // 監査イベントの識別子 HMAC 用。`wrangler secret put AUDIT_HMAC_SECRET` で登録する。
  AUDIT_HMAC_SECRET: string
  // 人事上の会社営業日を求める IANA タイムゾーン。未設定・不正値は認証と人事変更を拒否する。
  COMPANY_TIME_ZONE?: string
  // CORS で許可する Origin をカンマ区切りで指定する（例: "https://app.example.com,https://admin.example.com"）。
  // 未設定時はローカル開発用 Origin のみ許可。本番では必ず設定する。
  CORS_ORIGIN?: string
  // テストで現在時刻を固定するための注入点（本番では未設定 = 実時計）。
  NOW?: string
  // 有効化する company-optional 機能。"all" か機能キーのカンマ区切り（例: "thanks,one-on-ones"）。
  // 未設定・空・"none" は全 company-optional 機能を無効にする（.docs/feature-tiers.md の既定）。
  ENABLED_OPTIONAL_FEATURES?: string
  // 停止する company-standard 機能のカンマ区切り（例: "rooms,rentals"）。"all" で全停止。未設定は全て有効。
  DISABLED_STANDARD_FEATURES?: string
  // ログインエンドポイントのレート制限カウンターを保持する KV namespace。
  // `wrangler kv:namespace create RATE_LIMIT` で発行し wrangler.jsonc に設定する。
  RATE_LIMIT?: KVNamespace
  // ログイン以外の全エンドポイントの IP 単位グローバルレート制限（Workers Rate Limiting binding）。
  // wrangler.jsonc の ratelimits で設定する。未設定（ローカル開発・テスト）ではスキップする。
  API_RATE_LIMITER?: RateLimit
  // プロビジョニング（外部 identity の同期）エンドポイント専用の machine API キー。
  // `wrangler secret put PROVISIONING_API_KEY` で登録する。未設定なら全リクエストを拒否する。
  PROVISIONING_API_KEY?: string
  // ローカル・テスト用の公開JWKS。未設定の本番ではIDENTITY_ISSUERのJWKS endpointを使う。
  IDENTITY_JWKS?: string
  // 外部 identity トークンに期待する iss（発行者）。未設定なら identity ログインを拒否する。
  IDENTITY_ISSUER?: string
  // 外部 identity トークンに期待する aud（想定受信者）。未設定時は "open-karte" を既定とする。
  IDENTITY_AUDIENCE?: string
  // 初期 ROOT 作成用。`wrangler secret put BOOTSTRAP_TOKEN` で登録し、初期化完了後は削除を推奨。
  // 未設定時は機能無効（POST /bootstrap は 404 を返す）。
  BOOTSTRAP_TOKEN?: string
  // CLI（ネイティブアプリ）ログインで、本人確認を委ねる外部 identity provider（ブローカー）のログイン URL。
  // GET /auth/cli/login はこの URL へcallback/state/PKCE challengeを付けて302する。
  // 未設定なら CLI ログインを一律拒否する。
  IDENTITY_LOGIN_URL?: string
  // この API 自身の外部公開 origin（例: "https://api.example.com"）。
  // ブローカーへ渡す callback URL の組み立てと、identity トークンの audience 検証に使う。
  // 未設定なら CLI ログインを一律拒否する。
  API_ORIGIN?: string
}

export type RequestAuditContext = SystemRequestAudit

/** リクエストスコープの変数。database に Drizzle、session に本人（Session。認可判定は session.hasPermission）を載せる。 */
export type Variables = {
  companyActor?: CompanyActor
  database: DrizzleD1Database<typeof schema>
  session: Session | null
  auditContext: RequestAuditContext
  now: () => Date
  userId: string
  accountTokenVersion: number
  permissions: ReadonlySet<string>
  role: string
  oidcClientRegistry: OidcClientRegistry
  oidcIssuerConfiguration: OidcIssuerConfiguration
}

/** Hono の Env。new Hono<HonoEnv>() / createFactory<HonoEnv>() で使う。 */
export type HonoEnv = {
  Bindings: Bindings
  Variables: Variables
}

/** リポジトリ・ユースケースが受け取る Context の最小型。 */
export type Context = SystemDatabaseContext &
  SystemD1Context &
  SystemRequestAuditContext & {
    var: Pick<Variables, "companyActor" | "database" | "session" | "auditContext">
    env: Bindings
  }
