import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
/** /system/v1/browser-login-codes */
import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemBrowserLoginCode } from "@system/infrastructure/auth/create-system-browser-login-code"
import { systemLoginCodeHash } from "@system/infrastructure/auth/system-login-code-hash"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"

const CODE_TTL_MILLISECONDS = 60_000

// @authorization owner - 認証済みSystem Account自身へだけone-time codeを発行する
export const POST = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  const now = context.var.now()
  const accountId = zAccountId.safeParse(context.var.userId)
  if (!Number.isSafeInteger(now.getTime()) || !accountId.success) {
    throw new SystemHttpError({
      status: 503,
      code: "browser_login_code_unavailable",
      detail: "browser login is unavailable",
    })
  }

  const rawCode = crypto.randomUUID()
  const codeHash = await systemLoginCodeHash(rawCode)
  if (codeHash instanceof Error) {
    throw new SystemHttpError({
      status: 503,
      code: "browser_login_code_unavailable",
      detail: "browser login is unavailable",
    })
  }
  const creation = await createSystemBrowserLoginCode(
    { env: { DB: context.env.DB } },
    {
      codeHash,
      accountId: accountId.data,
      createdAt: now,
      expiresAt: new Date(now.getTime() + CODE_TTL_MILLISECONDS),
    },
  )
  if (creation instanceof Error) {
    throw new SystemHttpError({
      status: 503,
      code: "browser_login_code_unavailable",
      detail: "browser login is unavailable",
    })
  }

  return context.json({ code: rawCode, expires_in: CODE_TTL_MILLISECONDS / 1_000 }, 201)
})
