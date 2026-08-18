import { IssueEmployeeSession } from "@/contexts/company-compatibility/application/auth/issue-employee-session"
import { BrowserLoginCodeRepository } from "@/contexts/system-compatibility/infrastructure/auth/browser-login-code-repository"
import { IdentityRepository } from "@/contexts/company-compatibility/infrastructure/auth/identity-repository"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { zAppAuthToken } from "@/lib/app-schemas"
import { loginCodeHash } from "@/lib/auth/login-code-hash"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - 未認証で到達してよい
/**
 * POST /auth/browser/token — ブラウザ受け渡しの one-time code をセッションに交換する。
 * code は POST /auth/browser/code が認証済みの呼び出し元へ払い出した値で、1 回きり・60 秒 TTL。
 * code 自体は account id しか保持していない（トークンを保存領域に平文で置かないため）。
 * ここで account の最新状態を読み直し、有効なら初めて IssueEmployeeSession でセッションを発行する。
 * 無効・期限切れ・発行後にアカウントが無効化されていた場合は 401。
 */
export const POST = factory.createHandlers(
  zValidator("json", z.object({ code: z.string().min(1).max(200) })),
  async (c) => {
    const { code } = c.req.valid("json")

    const now = c.env.NOW === undefined ? new Date() : new Date(c.env.NOW)
    const nowEpoch = Math.floor(now.getTime() / 1_000)

    const codeHash = await loginCodeHash(code)

    const consumed = await new BrowserLoginCodeRepository(c).consume(codeHash, nowEpoch)
    if (consumed instanceof Error) {
      return c.json(
        { error: "browser login is unavailable", code: "browser_login_code_unavailable" },
        503,
      )
    }
    if (consumed === null) {
      throw new UnauthorizedError("invalid or expired code")
    }

    // code 発行から交換までの間にアカウントが無効化されている可能性があるため、最新状態を読み直す。
    const account = await new IdentityRepository(c).findAccountById(consumed.accountId)
    if (account instanceof Error) {
      return c.json(
        { error: "browser login is unavailable", code: "browser_login_code_unavailable" },
        503,
      )
    }
    if (account === null || account.employeeId === null || account.accountStatus !== "active") {
      throw new UnauthorizedError("invalid or expired code")
    }

    const issued = await new IssueEmployeeSession(c).run({
      accountId: account.accountId,
      employeeId: account.employeeId,
      tokenVersion: account.tokenVersion,
      jwtSecret: c.env.JWT_SECRET,
      userAgent: c.req.header("User-Agent") ?? null,
      now,
      successAction: "auth.session.browser_login_succeeded",
    })

    if (issued instanceof ApplicationError) {
      throw toHttpException(issued)
    }

    if ("reason" in issued) {
      throw new UnauthorizedError("invalid or expired code")
    }

    const responseBody = zAppAuthToken.parse({
      access_token: issued.accessToken,
      refresh_token: issued.refreshToken,
    })

    return c.json(responseBody, 200)
  },
)
