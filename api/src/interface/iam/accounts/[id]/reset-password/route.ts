import { ResetAccountPassword } from "@/application/iam/reset-account-password"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { z } from "zod"

// POST /accounts/:id/reset-password — 管理者がアカウントのパスワードを再設定（account:manage が必要）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ new_password: z.string().min(8).max(200) })),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const accountId = validateIntParam(c.req.param("id"), "account")

    const json = c.req.valid("json")

    const result = await new ResetAccountPassword(c).run({
      session: session,
      accountId: accountId,
      newPassword: json.new_password,
      now: c.env.NOW === undefined ? Date.now() : Date.parse(c.env.NOW),
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    return c.body(null, 204)
  },
)
