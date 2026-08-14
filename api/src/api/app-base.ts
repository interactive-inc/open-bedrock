import { HTTPException } from "hono/http-exception"
import { bodyLimit } from "hono/body-limit"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { contextStorage } from "hono/context-storage"
import { databaseMiddleware } from "@/contexts/company/interface/middlewares/database-middleware"
import { featureGate } from "@/contexts/company/interface/middlewares/feature-gate"
import { rateLimitMiddleware } from "@/contexts/company/interface/middlewares/rate-limit-middleware"
import { requestContextMiddleware } from "@/contexts/company/interface/middlewares/request-context-middleware"
import { factory } from "@/contexts/company/interface/utils/factory"
import { auditNoStore } from "@/contexts/company/interface/middlewares/audit-no-store"
import { toNegotiatedProblemResponse } from "@/contexts/system/interface/lib/to-negotiated-problem-response"

/** CORS_ORIGIN 未設定時に許可するローカル開発用 Origin。 */
const defaultAllowedOrigins = ["http://localhost:3000", "http://localhost:5173"]

let corsWarningLogged = false

/**
 * Origin リクエストヘッダを env.CORS_ORIGIN（カンマ区切り）と照合し、許可された Origin のみ返す。
 * 未設定時は defaultAllowedOrigins のみ許可し、セキュリティ警告をログに出す。
 * 本番では必ず CORS_ORIGIN を設定すること。
 */
function resolveAllowedOrigin(origin: string, allowList: string | undefined): string | null {
  if (allowList === undefined || allowList.trim() === "") {
    if (!corsWarningLogged) {
      corsWarningLogged = true
      console.warn(
        "[SECURITY] CORS_ORIGIN is not set — falling back to localhost origins. " +
          "Set CORS_ORIGIN in production to restrict cross-origin access.",
      )
    }
    return defaultAllowedOrigins.includes(origin) ? origin : null
  }

  const allowed = allowList
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  return allowed.includes(origin) ? origin : null
}

let nowProductionGuardWarned = false
const nowProductionGuardMiddleware = factory.createMiddleware(async (c, next) => {
  if (!nowProductionGuardWarned && c.env.CORS_ORIGIN !== undefined && c.env.NOW !== undefined) {
    nowProductionGuardWarned = true
    console.warn("[SECURITY] NOW override is set in production — this affects all timestamps")
  }
  await next()
})

const globalBodyLimit = bodyLimit({ maxSize: 1_000_000 })

const globalBodyLimitExceptAuditExport = factory.createMiddleware(async (c, next) => {
  if (c.req.path === "/audit-event-exports") {
    await next()
    return
  }

  await globalBodyLimit(c, next)
})

/**
 * 全ルート共通の土台。middleware・エラーハンドラだけを持ち、context routeは載せない。
 * context routeの登録は生成物である app.ts が行う（`bun run gen:app`）。
 *
 * このファイルは手で編集する。app.ts と分けているのは、生成器が
 * middleware 定義やエラーハンドラの本文を文字列として抱え込まないようにするため。
 */
export const appBase = factory
  .createApp()
  .use("*", requestContextMiddleware)
  .use("*", auditNoStore)
  .use(
    "*",
    cors({
      origin: (origin, c) => resolveAllowedOrigin(origin, c.env.CORS_ORIGIN),
      exposeHeaders: ["X-Request-ID", "Content-Disposition"],
    }),
  )
  .use("*", globalBodyLimitExceptAuditExport)
  .use("*", rateLimitMiddleware)
  // nosniff / HSTS / X-Frame-Options 等のセキュリティヘッダを付与する。
  // COOP/CORP は別オリジンの正規クライアント（web/cli）からの利用を阻害しうるため無効化する
  // （クロスオリジンアクセスの制御は CORS が担う）。
  .use("*", secureHeaders({ crossOriginResourcePolicy: false, crossOriginOpenerPolicy: false }))
  .use("*", contextStorage())
  .use("*", nowProductionGuardMiddleware)
  .use("*", featureGate)
  .use("*", databaseMiddleware)
  .onError(async (error, c) => {
    if (error instanceof HTTPException) {
      // toHttpException 経由の例外は res に {error, code} の JSON を積んでいる。
      // それを尊重して返し、CLI/AI が理由（message）と code を受け取れるようにする。
      // res 未設定の素の HTTPException（401/413/429 等）は従来どおり {error: message} を返す。
      if (error.res) {
        const negotiated = await toNegotiatedProblemResponse({
          error,
          accept: c.req.header("accept") ?? null,
        })
        if (negotiated !== null) return negotiated

        return error.getResponse()
      }

      return c.json({ error: error.message }, error.status)
    }

    console.error("[unhandled error]", error)

    return c.json({ error: "internal server error" }, 500)
  })
