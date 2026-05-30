import type { TokenPayload } from "@/domain/auth/token-payload"
import type { schema } from "@/schema"
import type { DrizzleD1Database } from "drizzle-orm/d1"

// Workers のバインディング（wrangler の vars / secrets / D1）。
export type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  // テストで現在時刻を固定するための注入点（本番では未設定 = 実時計）。
  NOW?: string
}

// 認証済みの本人（セッション）。
export type SessionPayload = TokenPayload

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
