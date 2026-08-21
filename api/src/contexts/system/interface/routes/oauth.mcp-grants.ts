import { JwtSecretMissingApplicationError } from "@/contexts/system/application/auth/errors"
import { McpGrantTokenService } from "@/contexts/system/infrastructure/auth/mcp-grant-token.service.repository"
import { systemFactory } from "@/contexts/system/interface/http/system-factory"
import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
import { requireSystemAuthentication } from "@system/interface/http/require-system-authentication"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { zAppMcpGrantResponse } from "@/contexts/system/interface/models/auth"

/**
 * MCP コネクタ接続の同意で grant を発行する (#2417)。
 *
 * 製品の同意画面が「接続を許可」で呼ぶ。認証済みSystem主体だけを受け付けるため、
 * 発行対象は常にセッション本人 (c.var.userId) で、body からは受け取らない。permission キーは
 * 要求しない。「自分のアカウントを自分の AI クライアントに繋ぐ」操作であり、付与されるのは
 * 本人が既に持っている権限そのものだから。
 *
 * DB には何も残さない。grant は署名付きの短命 JWT (120 秒) 自体が状態で、交換 API が署名と
 * PKCE verifier で検証する。
 */
// @authorization authenticated - 検証済みSystem Account本人のgrantだけを発行する
export const POST = systemFactory.createHandlers(
  requireSystemAuthentication,
  zValidator("json", z.object({ challenge: z.string().min(1) })),
  async (c) => {
    const body = c.req.valid("json")
    const secret = c.env.JWT_SECRET
    const result = await (async () => {
      if (secret === undefined || secret.length === 0) {
        return new JwtSecretMissingApplicationError()
      }

      const grant = await McpGrantTokenService.create(
        c.var.userId,
        c.var.accountTokenVersion,
        body.challenge,
        secret,
      )

      return { item: { grant } }
    })()

    if (result instanceof Error) {
      throw new SystemHttpError({
        status: result.status,
        code: result.body.error,
        detail: result.body.message,
        cause: result,
      })
    }

    return c.json(zAppMcpGrantResponse.parse(result))
  },
)
