import {
  SystemAuthenticationRateLimitedError,
  SystemCredentialsInvalidError,
  SystemInvalidSessionError,
  SystemSessionUnavailableError,
} from "@system/interface/errors"
/** /system/v1/sessions */
import { StableSystemAuditJsonValue } from "@system/domain/values/stable-system-audit-json.value"
import { IssueSystemSession } from "@system/application/auth/issue-system-session"
import { RevokeSystemSession } from "@system/application/auth/revoke-system-session"
import { RotateSystemSession } from "@system/application/auth/rotate-system-session"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event.repository"
import { SystemAccessTokenIssuer } from "@system/infrastructure/auth/system-access-token-issuer.repository"
import { SystemAccountRepository } from "@system/infrastructure/auth/system-account.repository"
import { SystemSessionMaterialService } from "@system/infrastructure/auth/system-session-material.service.repository"
import { SystemSessionRepository } from "@system/infrastructure/auth/system-session.repository"
import { decoySystemPasswordHash } from "@system/infrastructure/auth/decoy-system-password-hash.repository"
import { LoginRateLimitService } from "@system/infrastructure/auth/login-rate-limit.service.repository"
import { passwordHashNeedsRehash } from "@system/infrastructure/auth/password-hash-needs-rehash.repository"
import { SystemPasswordCredentialRepository } from "@system/infrastructure/auth/system-password-credential.repository"
import { verifySystemPassword } from "@system/infrastructure/auth/verify-system-password.repository"
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
      throw new SystemSessionUnavailableError()
    }

    const authorization = context.req.valid("header").authorization
    const token = authorization?.match(/^Bearer[ \t]+([0-9a-f]{64})$/iu)?.[1]
    if (token === undefined) {
      throw new SystemInvalidSessionError()
    }

    const now = new Date(context.env.NOW ?? Date.now())
    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    if (!Number.isSafeInteger(now.getTime()) || !Number.isSafeInteger(sessionTtlMilliseconds)) {
      throw new SystemSessionUnavailableError()
    }

    const systemContext = { env: { DB: database } }
    const sessionRepository = new SystemSessionRepository({ context: systemContext })
    const authentication = await sessionRepository.authenticate(
      { rawToken: token, now },
      new SystemSessionMaterialService(),
    )
    if (authentication instanceof Error) {
      throw new SystemSessionUnavailableError()
    }
    if (authentication.kind === "rejected") {
      throw new SystemInvalidSessionError()
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
      throw new SystemSessionUnavailableError()
    }

    const now = new Date(context.env.NOW ?? Date.now())
    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    if (!Number.isSafeInteger(now.getTime()) || !Number.isSafeInteger(sessionTtlMilliseconds)) {
      throw new SystemSessionUnavailableError()
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
      throw new SystemAuthenticationRateLimitedError()
    }

    const authentication = await new SystemPasswordCredentialRepository({ database }).authenticate(
      { subject: body.subject, password: body.password, now },
      {
        dummyHash: decoySystemPasswordHash,
        needsRehash: (passwordHash) => passwordHashNeedsRehash(passwordHash),
        verify: (password, passwordHash) => verifySystemPassword(password, passwordHash, pepper),
      },
    )
    if (authentication instanceof Error) {
      throw new SystemSessionUnavailableError()
    }
    if (authentication.kind === "rejected") {
      throw new SystemCredentialsInvalidError()
    }

    await rateLimit.resetForIdentifier({ identifier: body.subject })
    const metadataJson = StableSystemAuditJsonValue.create({
      client_ip: context.req.header("CF-Connecting-IP") ?? null,
      transport: "system.v1.sessions.password",
    })
    if (metadataJson instanceof Error) {
      throw new SystemSessionUnavailableError()
    }
    const systemContext = { env: { DB: database } }
    const issuance = await new IssueSystemSession({
      accountRepository: new SystemAccountRepository({ database }),
      sessionRepository: new SystemSessionRepository({ context: systemContext }),
      materialService: new SystemSessionMaterialService(),
      accessTokenIssuer: new SystemAccessTokenIssuer(context.env.JWT_SECRET ?? ""),
      sessionTtlMilliseconds,
    }).execute({
      accountId: authentication.accountId,
      tokenVersion: authentication.tokenVersion,
      now,
      auditContext: { authorizationJson: null, metadataJson: metadataJson?.toString() ?? null },
    })
    if (issuance instanceof Error) {
      throw new SystemSessionUnavailableError()
    }
    if (issuance.kind === "rejected") {
      throw new SystemCredentialsInvalidError()
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
      throw new SystemSessionUnavailableError()
    }

    const now = new Date(context.env.NOW ?? Date.now())
    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    if (!Number.isSafeInteger(now.getTime()) || !Number.isSafeInteger(sessionTtlMilliseconds)) {
      throw new SystemSessionUnavailableError()
    }

    const systemContext = { env: { DB: database } }
    const rotation = await new RotateSystemSession({
      accountRepository: new SystemAccountRepository({ database }),
      sessionRepository: new SystemSessionRepository({ context: systemContext }),
      auditAppender: new SystemAuditEventRepository(systemContext),
      materialService: new SystemSessionMaterialService(),
      accessTokenIssuer: new SystemAccessTokenIssuer(context.env.JWT_SECRET ?? ""),
      sessionTtlMilliseconds,
    }).execute({
      rawToken: context.req.valid("json").refresh_token,
      now,
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    if (rotation instanceof Error) {
      throw new SystemSessionUnavailableError()
    }
    if (rotation.kind === "rejected") {
      throw new SystemInvalidSessionError()
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
      throw new SystemSessionUnavailableError()
    }

    const now = new Date(context.env.NOW ?? Date.now())
    const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
    if (!Number.isSafeInteger(now.getTime()) || !Number.isSafeInteger(sessionTtlMilliseconds)) {
      throw new SystemSessionUnavailableError()
    }

    const systemContext = { env: { DB: database } }
    const revocation = await new RevokeSystemSession({
      sessionRepository: new SystemSessionRepository({ context: systemContext }),
      materialService: new SystemSessionMaterialService(),
    }).execute({
      rawToken: context.req.valid("json").refresh_token,
      now,
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    if (revocation instanceof Error) {
      throw new SystemSessionUnavailableError()
    }

    return context.body(null, 204)
  },
)
