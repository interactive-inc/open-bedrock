import { IssueEmployeeSession } from "@/application/auth/issue-employee-session"
import { CliLoginCodeRepository } from "@/infrastructure/auth/cli-login-code-repository"
import { IdentityRepository } from "@/infrastructure/auth/identity-repository"
import { loginCodeHash } from "@/lib/auth/login-code-hash"
import { factory } from "@/interface/utils/factory"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { ApplicationError } from "@/lib/errors"
import { zAppAuthToken } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - 未認証で到達してよい
/**
 * POST /auth/cli/token — CLI（ネイティブアプリ）ログインの one-time code をセッションに交換する。
 * code は GET /auth/cli/callback がループバックへ渡した値で、1 回きり・60 秒 TTL。
 * code 自体は解決済みの account/employee の id しか保持していない（トークンを保存領域に
 * 平文で置かないため）。ここで account の最新状態を読み直し、有効なら初めて
 * IssueEmployeeSession でセッション（access/refresh トークン）を発行する。
 * 消費に成功すれば /auth/login と同じ形（AccessTokenView）でトークンを返す。無効・期限切れ・
 * 消費後にアカウントが無効化されていた場合は 401。
 */
export const POST = factory.createHandlers(
  zValidator("json", z.object({ code: z.string().min(1).max(200) })),
  async (c) => {
    const { code } = c.req.valid("json")

    const now = c.env.NOW === undefined ? new Date() : new Date(c.env.NOW)
    const nowEpoch = Math.floor(now.getTime() / 1_000)

    const codeHash = await loginCodeHash(code)

    const consumed = await new CliLoginCodeRepository(c).consume(codeHash, nowEpoch)
    if (consumed instanceof Error) {
      return c.json({ error: "cli login is unavailable", code: "cli_login_code_unavailable" }, 503)
    }
    if (consumed === null) {
      throw new UnauthorizedError("invalid or expired code")
    }

    // code 発行から交換までの間にアカウントが無効化されている可能性があるため、最新状態を読み直す。
    const account = await new IdentityRepository(c).findAccountById(consumed.accountId)
    if (account instanceof Error) {
      return c.json({ error: "cli login is unavailable", code: "cli_login_code_unavailable" }, 503)
    }
    if (
      account === null ||
      account.employeeId !== consumed.employeeId ||
      account.accountStatus !== "active"
    ) {
      throw new UnauthorizedError("invalid or expired code")
    }

    const issued = await new IssueEmployeeSession(c).run({
      accountId: account.accountId,
      employeeId: consumed.employeeId,
      tokenVersion: account.tokenVersion,
      jwtSecret: c.env.JWT_SECRET,
      userAgent: c.req.header("User-Agent") ?? null,
      now,
      successAction: "auth.session.cli_login_succeeded",
    })

    if (issued instanceof ApplicationError) {
      throw toHttpException(issued)
    }

    const responseBody = zAppAuthToken.parse({
      access_token: issued.accessToken,
      refresh_token: issued.refreshToken,
    })

    return c.json(responseBody, 200)
  },
)
