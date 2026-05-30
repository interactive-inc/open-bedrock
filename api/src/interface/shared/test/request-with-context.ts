import { app } from "@/app"
import type { Bindings } from "@/env"

export type Props = {
  db: D1Database
  jwtSecret: string
  path: string
  token: string | null
  method?: string
  body?: unknown
  now?: string
}

// テスト用の既定の固定時刻。created_at 等の検証はこの値を期待値にする。
const defaultNow = "2026-01-01T00:00:00.000Z"

// テスト用: テスト DB と Bindings（JWT_SECRET と固定時刻）を渡して app を叩く。
// リクエストスコープは Hono の contextStorage が確立する。
export function requestWithContext(props: Props): Promise<Response> {
  const headers: Record<string, string> = {}

  if (props.token !== null) {
    headers.Authorization = `Bearer ${props.token}`
  }

  if (props.body !== undefined) {
    headers["content-type"] = "application/json"
  }

  const bindings: Bindings = {
    DB: props.db,
    JWT_SECRET: props.jwtSecret,
    NOW: props.now ?? defaultNow,
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
