import type { EmployeeStatus } from "@/lib/schemas"
import type { schema } from "@/schema"
import type { DrizzleD1Database } from "drizzle-orm/d1"

// Workers のバインディング（wrangler の vars / secrets / D1）。
export type Bindings = {
  DB: D1Database
  JWT_SECRET: string
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
}

// 認証済みの本人（セッション）。verify-bearer が JWT 検証後に DB から権限を解決して載せる。
// permissions/roleKeys が認可の正。認可判定は hasPermission(session, key) に委譲する。
export type SessionPayload = {
  accountId: number
  employeeId: number
  employeeStatus: EmployeeStatus
  permissions: ReadonlySet<string>
  roleKeys: ReadonlyArray<string>
}

// リクエストスコープの変数。database に Drizzle、session に本人を載せる。
export type Variables = {
  database: DrizzleD1Database<typeof schema>
  session: SessionPayload | null
}

// Hono の Env。new Hono<HonoEnv>() / createFactory<HonoEnv>() で使う。
export type HonoEnv = {
  Bindings: Bindings
  Variables: Variables
}

// リポジトリ・ユースケースが受け取る Context の最小型。
export type Context = {
  var: Variables
  env: Bindings
}
