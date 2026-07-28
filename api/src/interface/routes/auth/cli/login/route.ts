import { CliLoginStateRepository } from "@/infrastructure/auth/cli-login-state-repository"
import { factory } from "@/interface/utils/factory"
import { UnauthorizedError } from "@/interface/lib/errors"
import { UnavailableError } from "@/lib/errors"
import { cliIdentityRedirectUri } from "@/lib/auth/cli-identity-redirect-uri"
import { createPkce } from "@/lib/auth/create-pkce"
import { isSecureIdentityIssuer } from "@/lib/auth/is-secure-identity-issuer"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** one-time state の有効期限（秒）。ブラウザでの本人確認にかかる現実的な待ち時間を見込む。 */
const STATE_TTL_SECONDS = 600

const querySchema = z.object({
  port: z.coerce.number().int().min(1).max(65535),
  state: z.string().min(1).max(512),
})

// @authorization public - 未認証で到達してよい
/**
 * GET /auth/cli/login — CLI（ネイティブアプリ）ログインの入口。
 * CLI がローカルで listen しているループバックポートと、CLI 側の opaque な state を受け取り、
 * 外部 identity provider（ブローカー）へ本人確認を委ねる。ブローカーの callback には
 * この API 自身の /auth/cli/callback を渡し、そこへ渡す state は port・CLI state を紐付けた
 * 別の one-time 値にする（ブローカーに CLI のポートをそのまま渡さないため）。
 */
export const GET = factory.createHandlers(zValidator("query", querySchema), async (c) => {
  const identityLoginUrl = c.env.IDENTITY_LOGIN_URL
  const apiOrigin = c.env.API_ORIGIN

  if (
    identityLoginUrl === undefined ||
    identityLoginUrl.length === 0 ||
    apiOrigin === undefined ||
    apiOrigin.length === 0
  ) {
    // 設定不備は CLI ログインを一律拒否する（安全側）。
    throw new UnauthorizedError("cli login is not configured")
  }

  const { port, state: cliState } = c.req.valid("query")

  let brokerUrl: URL
  const redirectUri = cliIdentityRedirectUri(apiOrigin)
  try {
    brokerUrl = new URL(identityLoginUrl)
  } catch {
    throw new UnauthorizedError("cli login is not configured")
  }
  if (!isSecureIdentityIssuer(brokerUrl) || redirectUri instanceof Error) {
    throw new UnauthorizedError("cli login is not configured")
  }

  const now = c.env.NOW === undefined ? new Date() : new Date(c.env.NOW)
  const nowEpoch = Math.floor(now.getTime() / 1_000)

  const brokerState = crypto.randomUUID()
  const pkce = await createPkce()

  const created = await new CliLoginStateRepository(c).create(
    brokerState,
    { port, cliState, codeVerifier: pkce.verifier },
    nowEpoch + STATE_TTL_SECONDS,
  )
  if (created instanceof Error) {
    throw toHttpException(
      new UnavailableError("cli login is unavailable", "cli_login_state_unavailable", {
        cause: created,
      }),
    )
  }

  brokerUrl.searchParams.set("callback", redirectUri)
  brokerUrl.searchParams.set("state", brokerState)
  brokerUrl.searchParams.set("code_challenge", pkce.challenge)
  brokerUrl.searchParams.set("code_challenge_method", "S256")

  return c.redirect(brokerUrl.toString(), 302)
})
