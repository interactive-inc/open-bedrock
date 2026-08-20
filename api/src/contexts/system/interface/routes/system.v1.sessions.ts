/** /system/v1/sessions */
import { AuthenticateSystemPassword } from "@system/application/auth/authenticate-system-password"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { createSystemSessionApplications } from "@system/interface/runtime/create-system-session-applications"
import { decoySystemPasswordHash } from "@system/infrastructure/auth/decoy-system-password-hash"
import { LoginRateLimitService } from "@system/infrastructure/auth/login-rate-limit.service"
import { PasswordHashService } from "@system/infrastructure/auth/password-hash.service"
import { SystemPasswordCredentialRepository } from "@system/infrastructure/auth/system-password-credential-repository"
import { verifySystemPassword } from "@system/infrastructure/auth/verify-system-password"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { zValidator } from "@hono/zod-validator"
import { drizzle } from "drizzle-orm/d1"
import { createFactory } from "hono/factory"
import { z } from "zod"

export type SystemSessionHttpEnvironment = {
  Bindings: {
    DB?: D1Database
    NOW?: string | number
    PEPPER_SECRET?: string
    JWT_SECRET?: string
    SYSTEM_SESSION_TTL_SECONDS?: string
  }
}

const factory = createFactory<SystemSessionHttpEnvironment>()

// @authorization public - opaque Session token自体をcredentialとして検証する
export const GET = factory.createHandlers(
  zValidator("header", z.object({ authorization: z.string().optional() })),
  async (context) => {
    const database = context.env?.DB
    if (database === undefined) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const authorization = context.req.valid("header").authorization
    const token = authorization?.match(/^Bearer[ \t]+([0-9a-f]{64})$/iu)?.[1]
    if (token === undefined) {
      return context.json({ error: "invalid session", code: "invalid_session" }, 401)
    }

    const now = new Date(context.env.NOW ?? Date.now())
    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    if (!Number.isSafeInteger(now.getTime()) || !Number.isSafeInteger(sessionTtlMilliseconds)) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const applications = createSystemSessionApplications({
      context: { env: { DB: database } },
      jwtSecret: context.env.JWT_SECRET ?? "",
      sessionTtlMilliseconds,
    })
    if (applications instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const authentication = await applications.authenticate.execute({ rawToken: token, now })
    if (authentication instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }
    if (authentication.kind === "rejected") {
      return context.json({ error: "invalid session", code: "invalid_session" }, 401)
    }

    return context.json(
      {
        account_id: authentication.accountId,
        session_id: authentication.sessionId,
        expires_at: authentication.expiresAt.toISOString(),
      },
      200,
    )
  },
)

// @authorization public - password credentialを検証しcanonical opaque Sessionを発行する
export const POST = factory.createHandlers(
  zValidator(
    "json",
    z.object({
      subject: z
        .string()
        .trim()
        .toLowerCase()
        .email()
        .min(1)
        .max(255)
        .regex(/^[\x20-\x7e]+$/)
        .brand<"IdentitySubject">(),
      password: z.string().min(1).max(200),
    }),
  ),
  async (context) => {
    const database = context.env?.DB
    const pepper = context.env?.PEPPER_SECRET
    if (database === undefined || pepper === undefined || pepper.length === 0) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const now = new Date(context.env.NOW ?? Date.now())
    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    if (!Number.isSafeInteger(now.getTime()) || !Number.isSafeInteger(sessionTtlMilliseconds)) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const body = context.req.valid("json")
    const rateLimit = new LoginRateLimitService({
      var: {
        database: drizzle(database, { schema: systemCoreSchema }),
        now: () => now,
      },
    })
    const gate = await rateLimit.recordAndCheck({
      identifier: body.subject,
      ip: context.req.header("CF-Connecting-IP") ?? null,
      now: now.getTime(),
    })
    if (gate.limited) {
      return context.json({ error: "too many requests", code: "authentication_rate_limited" }, 429)
    }

    const authentication = await new AuthenticateSystemPassword({
      credentialRepository: new SystemPasswordCredentialRepository({ database }),
      passwordMaterialService: {
        dummyHash: decoySystemPasswordHash,
        needsRehash: (passwordHash) => PasswordHashService.needsRehash(passwordHash),
        verify: (password, passwordHash) => verifySystemPassword(password, passwordHash, pepper),
      },
    }).execute({ subject: body.subject, password: body.password, now })
    if (authentication instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }
    if (authentication.kind === "rejected") {
      return context.json({ error: "invalid credentials", code: "invalid_credentials" }, 401)
    }

    await rateLimit.resetForIdentifier({ identifier: body.subject })
    const metadataJson = toStableSystemAuditJson({
      client_ip: context.req.header("CF-Connecting-IP") ?? null,
      transport: "system.v1.sessions.password",
    })
    if (metadataJson instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }
    const applications = createSystemSessionApplications({
      context: { env: { DB: database } },
      jwtSecret: context.env.JWT_SECRET ?? "",
      sessionTtlMilliseconds,
    })
    if (applications instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }
    const issuance = await applications.issue.execute({
      accountId: authentication.accountId,
      tokenVersion: authentication.tokenVersion,
      now,
      auditContext: { authorizationJson: null, metadataJson },
    })
    if (issuance instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }
    if (issuance.kind === "rejected") {
      return context.json({ error: "invalid credentials", code: "invalid_credentials" }, 401)
    }

    return context.json(
      {
        account_id: issuance.accountId,
        access_token: issuance.accessToken,
        refresh_token: issuance.rawToken,
        session_id: issuance.sessionId,
        expires_at: issuance.expiresAt.toISOString(),
      },
      201,
    )
  },
)

// @authorization public - refresh tokenのrotationと再利用検知をSystemが行う
export const PATCH = factory.createHandlers(
  zValidator(
    "json",
    z.object({
      refresh_token: z
        .string()
        .length(64)
        .regex(/^[0-9a-f]+$/i),
    }),
  ),
  async (context) => {
    const database = context.env?.DB
    if (database === undefined) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const now = new Date(context.env.NOW ?? Date.now())
    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    if (!Number.isSafeInteger(now.getTime()) || !Number.isSafeInteger(sessionTtlMilliseconds)) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const applications = createSystemSessionApplications({
      context: { env: { DB: database } },
      jwtSecret: context.env.JWT_SECRET ?? "",
      sessionTtlMilliseconds,
    })
    if (applications instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const rotation = await applications.rotate.execute({
      rawToken: context.req.valid("json").refresh_token,
      now,
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    if (rotation instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }
    if (rotation.kind === "rejected") {
      return context.json({ error: "invalid session", code: "invalid_session" }, 401)
    }

    return context.json(
      {
        account_id: rotation.accountId,
        access_token: rotation.accessToken,
        refresh_token: rotation.rawToken,
        session_id: rotation.sessionId,
        expires_at: rotation.expiresAt.toISOString(),
      },
      200,
    )
  },
)

// @authorization public - tokenの実在を漏らさずSession familyを冪等失効する
export const DELETE = factory.createHandlers(
  zValidator(
    "json",
    z.object({
      refresh_token: z
        .string()
        .length(64)
        .regex(/^[0-9a-f]+$/i),
    }),
  ),
  async (context) => {
    const database = context.env?.DB
    if (database === undefined) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const now = new Date(context.env.NOW ?? Date.now())
    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    if (!Number.isSafeInteger(now.getTime()) || !Number.isSafeInteger(sessionTtlMilliseconds)) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const applications = createSystemSessionApplications({
      context: { env: { DB: database } },
      jwtSecret: context.env.JWT_SECRET ?? "",
      sessionTtlMilliseconds,
    })
    if (applications instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const revocation = await applications.revoke.execute({
      rawToken: context.req.valid("json").refresh_token,
      now,
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    if (revocation instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    return context.body(null, 204)
  },
)
