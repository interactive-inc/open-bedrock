import { SystemHttpError } from "@system/interface/http/system-http-error"
/** /system/v1/bootstrap */
import { BootstrapSystemRoot } from "@system/application/iam/bootstrap-system-root"
import { isSystemBootstrapTokenUsable } from "@system/domain/configuration/is-system-bootstrap-token-usable"
import { PasswordHashService } from "@system/infrastructure/auth/password-hash.service"
import { timingSafeStringEqual } from "@system/infrastructure/auth/timing-safe-string-equal"
import { SystemRootBootstrapRepositoryD1 } from "@system/infrastructure/iam/system-root-bootstrap-repository"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - single-use secretと永続bootstrap stateで初期root作成だけを許す
export const POST = systemFactory.createHandlers(
  systemFactory.createMiddleware(async (context, next) => {
    if (!isSystemBootstrapTokenUsable(context.env.BOOTSTRAP_TOKEN)) {
      throw new SystemHttpError({
        status: 404,
        code: "not_found",
        detail: "not found",
      })
    }

    await next()
  }),
  zValidator(
    "json",
    z
      .object({
        token: z.string().min(16).max(4096),
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
  ),
  async (context) => {
    const expectedToken = context.env.BOOTSTRAP_TOKEN
    if (!isSystemBootstrapTokenUsable(expectedToken) || expectedToken === undefined) {
      throw new SystemHttpError({
        status: 404,
        code: "not_found",
        detail: "not found",
      })
    }
    const body = context.req.valid("json")
    if (!(await timingSafeStringEqual(body.token, expectedToken))) {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_credential",
        detail: "invalid bootstrap credential",
      })
    }
    const pepper = context.env.PEPPER_SECRET
    if (pepper === undefined || pepper.length === 0) {
      throw new SystemHttpError({
        status: 503,
        code: "bootstrap_unavailable",
        detail: "bootstrap service unavailable",
      })
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemHttpError({
        status: 503,
        code: "bootstrap_unavailable",
        detail: "bootstrap service unavailable",
      })
    }
    const bootstrap = await new BootstrapSystemRoot({
      passwordHasher: {
        hash: (password) =>
          PasswordHashService.hash(password, pepper).catch((caught: unknown) =>
            caught instanceof Error ? caught : new Error("failed to hash System password"),
          ),
      },
      repository: new SystemRootBootstrapRepositoryD1({ env: { DB: context.env.DB } }),
    }).execute({ email: body.email, password: body.password, now })
    if (bootstrap instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "bootstrap_unavailable",
        detail: "bootstrap service unavailable",
      })
    }
    if (bootstrap.kind === "invalid_input") {
      throw new SystemHttpError({
        status: 400,
        code: bootstrap.reason,
        detail: "invalid bootstrap input",
      })
    }
    if (bootstrap.kind === "already_initialized") {
      throw new SystemHttpError({
        status: 409,
        code: "already_initialized",
        detail: "already initialized",
      })
    }

    return context.json(
      {
        account_id: bootstrap.accountId,
        identity_id: bootstrap.identityId,
        root_binding_id: bootstrap.rootBindingId,
        email: bootstrap.email,
      },
      201,
    )
  },
)
