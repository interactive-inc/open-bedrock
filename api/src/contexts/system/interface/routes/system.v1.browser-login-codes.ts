import { SystemBrowserLoginCodeUnavailableError } from "@system/interface/errors"
/** /system/v1/browser-login-codes */
import { zAccountId } from "@system/domain/values/account-id.schema"
import { createSystemBrowserLoginCode } from "@system/infrastructure/auth/create-system-browser-login-code.repository"
import { systemLoginCodeHash } from "@system/infrastructure/auth/system-login-code-hash.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"

const CODE_TTL_MILLISECONDS = 60_000

// @authorization owner - 認証済みSystem Account自身へだけone-time codeを発行する
export const POST = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  const now = context.var.now()
  const accountId = zAccountId.safeParse(context.var.userId)
  if (!Number.isSafeInteger(now.getTime()) || !accountId.success) {
    throw new SystemBrowserLoginCodeUnavailableError()
  }

  const rawCode = crypto.randomUUID()
  const codeHash = await systemLoginCodeHash(rawCode)
  if (codeHash instanceof Error) {
    throw new SystemBrowserLoginCodeUnavailableError()
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
    throw new SystemBrowserLoginCodeUnavailableError()
  }

  return context.json({ code: rawCode, expires_in: CODE_TTL_MILLISECONDS / 1_000 }, 201)
})
