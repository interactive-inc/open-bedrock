/** /system/v1/accounts/:accountId/identities */
import { zAccountId } from "@system/domain/auth/account-id"
import { validateSystemPassword } from "@system/domain/auth/system-password-policy"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import { IdentityBinding } from "@system/domain/identity/identity-binding.entity"
import { PasswordHashService } from "@system/infrastructure/auth/password-hash.service"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { SystemAccountAdministrationRepository } from "@system/infrastructure/iam/system-account-administration-repository"
import { SystemIdentityAdministrationRepository } from "@system/infrastructure/identity/system-identity-administration-repository"
import { authenticateSystemSession } from "@system/interface/http/authenticate-system-session"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission iam:read - AccountのIdentity bindingと公開profileだけを読む
export const GET = systemFactory.createHandlers(authenticateSystemSession, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    return context.json({ error: "forbidden", code: "forbidden" }, 403)
  }
  const accountId = zAccountId.safeParse(context.req.param("accountId"))
  if (!accountId.success) {
    return context.json({ error: "account not found", code: "account_not_found" }, 404)
  }
  const account = await new SystemAccountAdministrationRepository({
    env: { DB: context.env.DB },
  }).findById(accountId.data)
  if (account instanceof Error) {
    return context.json(
      { error: "identity service unavailable", code: "identity_unavailable" },
      503,
    )
  }
  if (account === null) {
    return context.json({ error: "account not found", code: "account_not_found" }, 404)
  }
  const identities = await new SystemIdentityAdministrationRepository({
    env: { DB: context.env.DB },
  }).listForAccount(accountId.data)
  if (identities instanceof Error) {
    return context.json(
      { error: "identity service unavailable", code: "identity_unavailable" },
      503,
    )
  }

  return context.json(
    {
      identities: identities.map((identity) => ({
        id: identity.binding.id,
        account_id: identity.binding.accountId,
        provider: identity.binding.provider,
        subject: identity.binding.subject,
        state: identity.binding.state,
        email: identity.email,
        email_verified: identity.isEmailVerified,
        last_used_at: identity.lastUsedAt?.toISOString() ?? null,
        created_at: identity.binding.createdAt.toISOString(),
        activated_at: identity.binding.activatedAt?.toISOString() ?? null,
        revoked_at: identity.binding.revokedAt?.toISOString() ?? null,
      })),
      total: identities.length,
    },
    200,
  )
})

// @authorization permission iam:write - provider credentialをIdentityと同じtransactionで作る
export const POST = systemFactory.createHandlers(
  authenticateSystemSession,
  zValidator(
    "json",
    z.discriminatedUnion("provider", [
      z
        .object({
          provider: z.literal("password"),
          email: z
            .string()
            .trim()
            .toLowerCase()
            .email()
            .min(3)
            .max(254)
            .regex(/^[\x20-\x7e]+$/),
          password: z.string().min(12).max(200),
        })
        .strict(),
      z
        .object({
          provider: z.enum(["google", "github", "oidc"]),
          subject: z
            .string()
            .min(1)
            .max(255)
            .regex(/^[\x20-\x7e]+$/),
          email: z.string().trim().toLowerCase().email().max(254).nullable(),
          email_verified: z.boolean(),
        })
        .strict(),
    ]),
  ),
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      return context.json({ error: "forbidden", code: "forbidden" }, 403)
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const targetAccountId = zAccountId.safeParse(context.req.param("accountId"))
    if (!actorAccountId.success) {
      return context.json({ error: "invalid session", code: "invalid_session" }, 401)
    }
    if (!targetAccountId.success) {
      return context.json({ error: "account not found", code: "account_not_found" }, 404)
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      return context.json(
        { error: "identity service unavailable", code: "identity_unavailable" },
        503,
      )
    }
    const body = context.req.valid("json")
    if (body.provider === "password" && validateSystemPassword(body.password) !== null) {
      return context.json({ error: "invalid password", code: "invalid_password" }, 400)
    }
    const subject = body.provider === "password" ? body.email : body.subject
    const email = body.email
    const isEmailVerified = body.provider === "password" ? true : body.email_verified
    const binding = IdentityBinding.create({
      id: crypto.randomUUID(),
      accountId: targetAccountId.data,
      provider: body.provider,
      subject,
      createdAt: now,
      activatedAt: now,
      revokedAt: null,
    })
    if (binding instanceof Error) {
      return context.json({ error: "invalid identity", code: "invalid_identity" }, 400)
    }
    const pepper = context.env.PEPPER_SECRET
    if (body.provider === "password" && (pepper === undefined || pepper.length === 0)) {
      return context.json(
        { error: "identity service unavailable", code: "identity_unavailable" },
        503,
      )
    }
    const passwordHash =
      body.provider === "password" && pepper !== undefined
        ? await PasswordHashService.hash(body.password, pepper).catch((caught: unknown) =>
            caught instanceof Error ? caught : new Error("failed to hash System password"),
          )
        : null
    if (passwordHash instanceof Error) {
      console.error(
        JSON.stringify({ event: "system_identity_password_hash_failed", error: passwordHash.name }),
      )
      return context.json(
        { error: "identity service unavailable", code: "identity_unavailable" },
        503,
      )
    }
    const afterJson = toStableSystemAuditJson({
      account_id: binding.accountId,
      email,
      email_verified: isEmailVerified,
      provider: binding.provider,
      subject: binding.subject,
    })
    if (afterJson instanceof Error) {
      return context.json(
        { error: "identity service unavailable", code: "identity_unavailable" },
        503,
      )
    }
    const auditEvent = createSystemAuditEvent({
      actorAccountId: actorAccountId.data,
      action: "system.identity.created",
      targetType: "system:identity",
      targetId: binding.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson,
      metadataJson: null,
      occurredAt: now,
    })
    if (auditEvent instanceof Error) {
      return context.json(
        { error: "identity service unavailable", code: "identity_unavailable" },
        503,
      )
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const creation = await new SystemIdentityAdministrationRepository({
      env: { DB: context.env.DB },
    }).create({
      actorAccountId: actorAccountId.data,
      binding,
      email,
      isEmailVerified,
      passwordHash,
      auditStatements,
    })
    if (creation instanceof Error) {
      return context.json(
        { error: "identity service unavailable", code: "identity_unavailable" },
        503,
      )
    }
    if (creation === "forbidden") {
      return context.json({ error: "forbidden", code: "forbidden" }, 403)
    }
    if (creation === "conflict") {
      return context.json({ error: "identity conflict", code: "identity_conflict" }, 409)
    }

    return context.json(
      {
        id: binding.id,
        account_id: binding.accountId,
        provider: binding.provider,
        subject: binding.subject,
        state: binding.state,
        email,
        email_verified: isEmailVerified,
        last_used_at: null,
        created_at: binding.createdAt.toISOString(),
        activated_at: binding.activatedAt?.toISOString() ?? null,
        revoked_at: null,
      },
      201,
    )
  },
)
