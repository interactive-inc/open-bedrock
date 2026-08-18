import { createSystemSessionApplications } from "@system/infrastructure/auth/create-system-session-applications"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

export type SystemSessionHttpEnvironment = {
  Bindings: {
    DB?: D1Database
    NOW?: string | number
    SYSTEM_SESSION_TTL_SECONDS?: string
  }
}

const factory = createFactory<SystemSessionHttpEnvironment>()

// @authorization public - opaque Session token自体をcredentialとして検証する
export const GET = factory.createHandlers(async (context) => {
  const database = context.env?.DB
  if (database === undefined) {
    return context.json({ error: "session service unavailable", code: "session_unavailable" }, 503)
  }

  const authorization = context.req.header("authorization")
  const token = authorization?.match(/^Bearer[ \t]+([0-9a-f]{64})$/iu)?.[1]
  if (token === undefined) {
    return context.json({ error: "invalid session", code: "invalid_session" }, 401)
  }

  const now = new Date(context.env.NOW ?? Date.now())
  const sessionTtlMilliseconds = Number(context.env.SYSTEM_SESSION_TTL_SECONDS ?? 604_800) * 1_000
  if (!Number.isSafeInteger(now.getTime()) || !Number.isSafeInteger(sessionTtlMilliseconds)) {
    return context.json({ error: "session service unavailable", code: "session_unavailable" }, 503)
  }

  const applications = createSystemSessionApplications({
    context: { env: { DB: database } },
    sessionTtlMilliseconds,
  })
  if (applications instanceof Error) {
    return context.json({ error: "session service unavailable", code: "session_unavailable" }, 503)
  }

  const result = await applications.authenticate.execute({ rawToken: token, now })
  if (result instanceof Error) {
    return context.json({ error: "session service unavailable", code: "session_unavailable" }, 503)
  }
  if (result.kind === "rejected") {
    return context.json({ error: "invalid session", code: "invalid_session" }, 401)
  }

  return context.json(
    {
      account_id: result.accountId,
      session_id: result.sessionId,
      expires_at: result.expiresAt.toISOString(),
    },
    200,
  )
})

// @authorization public - refresh tokenのrotationと再利用検知をSystemが行う
export const POST = factory.createHandlers(
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
      sessionTtlMilliseconds,
    })
    if (applications instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const result = await applications.rotate.execute({
      rawToken: context.req.valid("json").refresh_token,
      now,
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    if (result instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }
    if (result.kind === "rejected") {
      return context.json({ error: "invalid session", code: "invalid_session" }, 401)
    }

    return context.json(
      {
        account_id: result.accountId,
        refresh_token: result.rawToken,
        session_id: result.sessionId,
        expires_at: result.expiresAt.toISOString(),
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
      sessionTtlMilliseconds,
    })
    if (applications instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    const result = await applications.revoke.execute({
      rawToken: context.req.valid("json").refresh_token,
      now,
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    if (result instanceof Error) {
      return context.json(
        { error: "session service unavailable", code: "session_unavailable" },
        503,
      )
    }

    return context.body(null, 204)
  },
)
