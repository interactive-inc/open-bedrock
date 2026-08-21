import { HTTPException } from "hono/http-exception"
import { handleApiError } from "@/api/http/handle-api-error"
import { companyValidationErrorMiddleware } from "@/api/http/company-validation-error-middleware"
import { bodyLimit } from "hono/body-limit"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { contextStorage } from "hono/context-storage"
import { databaseMiddleware } from "@/api/database-middleware"
import { featureGate } from "@/api/http/middlewares/feature-gate"
import { rateLimitMiddleware } from "@/api/http/middlewares/rate-limit-middleware"
import { requestContextMiddleware } from "@/api/http/middlewares/request-context-middleware"
import { factory } from "@/api/http/factory"
import { auditNoStore } from "@/api/http/middlewares/audit-no-store"
import { verifyBearer } from "@/api/http/verify-bearer"
import type { CompanyCapability } from "@/contexts/company/domain/values/company-actor.definition"
import { OidcClientRegistryValue } from "@system/domain/values/oidc-client-registry.value"
import { OidcIssuerConfigurationValue } from "@system/domain/values/oidc-issuer-configuration.value"
import { SystemIdentityUnavailableError } from "@system/interface/errors"

/** CORS_ORIGIN 未設定時に許可するローカル開発用 Origin。 */
const defaultAllowedOrigins = ["http://localhost:3000", "http://localhost:5173"]
const disabledOidcClientRegistry = OidcClientRegistryValue.restore({})
if (disabledOidcClientRegistry instanceof Error) throw disabledOidcClientRegistry
const disabledOidcIssuerConfiguration = OidcIssuerConfigurationValue.create({
  issuersByHostname: Object.freeze({}),
  localProxyHostnames: Object.freeze([]),
  localIssuerHostname: null,
})
if (disabledOidcIssuerConfiguration instanceof Error) throw disabledOidcIssuerConfiguration

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
  const oidcClientRegistry =
    c.env.OIDC_CLIENT_REGISTRY === undefined
      ? disabledOidcClientRegistry
      : OidcClientRegistryValue.restore(c.env.OIDC_CLIENT_REGISTRY)
  const oidcIssuerConfiguration =
    c.env.OIDC_ISSUER_CONFIGURATION === undefined
      ? disabledOidcIssuerConfiguration
      : OidcIssuerConfigurationValue.create(c.env.OIDC_ISSUER_CONFIGURATION)
  if (oidcClientRegistry instanceof Error || oidcIssuerConfiguration instanceof Error) {
    throw new SystemIdentityUnavailableError()
  }

  c.set("now", () => new Date(c.env.NOW ?? Date.now()))
  c.set("oidcClientRegistry", oidcClientRegistry)
  c.set("oidcIssuerConfiguration", oidcIssuerConfiguration)
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
  if (c.req.path === "/company/v1/bootstrap") {
    await next()
    return
  }

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
  .use("*", companyValidationErrorMiddleware())
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
  .use("/company/*", verifyBearer)
  .use("/company/*", companyActorMiddleware)
  .onError(handleApiError)

/** 生成routeを型計算可能な単位へ分割して合成するための空のHono appを作る。 */
export function createRouteApp() {
  return factory.createApp()
}
