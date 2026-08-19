import { HTTPException } from "hono/http-exception"
import { bodyLimit } from "hono/body-limit"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { contextStorage } from "hono/context-storage"
import { databaseMiddleware } from "@/api/database-middleware"
import { featureGate } from "@/contexts/company/interface/middlewares/feature-gate"
import { rateLimitMiddleware } from "@/contexts/company/interface/middlewares/rate-limit-middleware"
import { requestContextMiddleware } from "@/contexts/company/interface/middlewares/request-context-middleware"
import { factory } from "@/contexts/company/interface/utils/factory"
import { auditNoStore } from "@/contexts/company/interface/middlewares/audit-no-store"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import type { CompanyCapability } from "@/contexts/company/application/core/company-actor"
import { toNegotiatedHttpExceptionResponse } from "@/api/to-negotiated-http-exception-response"
import type { OidcClientRegistry } from "@system/domain/identity/oidc-client.policy"
import type { OidcIssuerConfiguration } from "@system/domain/identity/oidc.value"

/** CORS_ORIGIN 未設定時に許可するローカル開発用 Origin。 */
const defaultAllowedOrigins = ["http://localhost:3000", "http://localhost:5173"]
const disabledOidcClientRegistry: OidcClientRegistry = Object.freeze({})
const disabledOidcIssuerConfiguration: OidcIssuerConfiguration = Object.freeze({
  issuersByHostname: Object.freeze({}),
  localProxyHostnames: Object.freeze([]),
  localIssuerHostname: null,
})

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

const systemContextMiddleware = factory.createMiddleware(async (c, next) => {
  c.set("now", () => new Date(c.env.NOW ?? Date.now()))
  c.set("oidcClientRegistry", c.env.OIDC_CLIENT_REGISTRY ?? disabledOidcClientRegistry)
  c.set(
    "oidcIssuerConfiguration",
    c.env.OIDC_ISSUER_CONFIGURATION ?? disabledOidcIssuerConfiguration,
  )
  await next()
})

const systemAuthorizationMiddleware = factory.createMiddleware(async (c, next) => {
  const session = c.var.session
  if (session === null) throw new HTTPException(401, { message: "authentication required" })

  c.set("userId", String(session.accountId))
  c.set("permissions", session.permissions)
  c.set("role", session.roleKeys[0] ?? "authenticated")
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

const companyActorMiddleware = factory.createMiddleware(async (c, next) => {
  const session = c.var.session
  if (session === null) throw new HTTPException(401, { message: "authentication required" })

  const capabilities: CompanyCapability[] = []
  if (
    session.hasPermission("system:admin") ||
    session.hasPermission("employee:read") ||
    session.hasPermission("org:manage")
  ) {
    capabilities.push("company:read")
  }
  if (
    session.hasPermission("system:admin") ||
    session.hasPermission("employee:create") ||
    session.hasPermission("employee:update") ||
    session.hasPermission("org:manage")
  ) {
    capabilities.push("company:write")
  }
  if (session.hasPermission("system:admin")) capabilities.push("company:admin")

  c.set("companyActor", {
    accountId: `account:${session.accountId}`,
    employeeId: `employee:${session.employeeId}`,
    organizationIds: ["organization:default"],
    capabilities,
  })
  await next()
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
  .use("*", systemContextMiddleware)
  .use("*", featureGate)
  .use("*", databaseMiddleware)
  .use("/oauth/authorizations", verifyBearer)
  .use("/oauth/authorizations", systemAuthorizationMiddleware)
  .use("/oauth/mcp-grants", verifyBearer)
  .use("/oauth/mcp-grants", systemAuthorizationMiddleware)
  .use("/company/v1/*", verifyBearer)
  .use("/company/v1/*", companyActorMiddleware)
  .onError(async (error, c) => {
    if (error instanceof HTTPException) {
      // toHttpException 経由の例外は res に {error, code} の JSON を積んでいる。
      // それを尊重して返し、CLI/AI が理由（message）と code を受け取れるようにする。
      // res 未設定の素の HTTPException（401/413/429 等）は従来どおり {error: message} を返す。
      if (error.res) {
        const negotiated = await toNegotiatedHttpExceptionResponse({
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

/** 生成routeを型計算可能な単位へ分割して合成するための空のHono appを作る。 */
export function createRouteApp() {
  return factory.createApp()
}
