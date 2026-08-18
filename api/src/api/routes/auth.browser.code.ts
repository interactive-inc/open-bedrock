import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemBrowserLoginCode } from "@system/infrastructure/auth/create-system-browser-login-code"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { zAppBrowserLoginCode } from "@/lib/app-schemas"
import { loginCodeHash } from "@/lib/auth/login-code-hash"

/** one-time code の有効期限（秒）。発行直後にブラウザを開いて交換する前提の短命値。 */
const CODE_TTL_SECONDS = 60

// @authorization owner - 本人のリソースに限定する
/**
 * POST /auth/browser/code — 認証済みの呼び出し元が、自分のセッションをブラウザへ
 * 受け渡すための one-time code を発行する。呼び出し元は Bearer トークンで本人確認済みなので、
 * ここでは identity の再検証をせず c.var.session の account を code に紐づける。
 * code は生の値を保存せずハッシュのみ格納し、1 回きり・60 秒 TTL。
 * ブラウザ側は受け取った code を POST /auth/browser/token に渡してセッションへ交換する。
 */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const now = c.env.NOW === undefined ? new Date() : new Date(c.env.NOW)
  const rawCode = crypto.randomUUID()
  const codeHash = await loginCodeHash(rawCode)

  const created = await createSystemBrowserLoginCode(c, {
    codeHash,
    accountId: zAccountId.parse(String(session.accountId)),
    createdAt: now,
    expiresAt: new Date(now.getTime() + CODE_TTL_SECONDS * 1_000),
  })

  if (created instanceof Error) {
    return c.json(
      { error: "browser login is unavailable", code: "browser_login_code_unavailable" },
      503,
    )
  }

  const responseBody = zAppBrowserLoginCode.parse({
    code: rawCode,
    expires_in: CODE_TTL_SECONDS,
  })

  return c.json(responseBody, 200)
})
