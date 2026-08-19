import { ResetAccountPassword } from "@/contexts/company/application/iam/reset-account-password"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { NotFoundError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAccountId } from "@system/domain/auth/account-id"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /accounts/:id/reset-password — 管理者がアカウントのパスワードを再設定（account:manage が必要） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      new_password: z.string().min(12).max(200),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const accountId = zAccountId.safeParse(c.req.param("id"))
    if (!accountId.success) throw new NotFoundError("account not found")

    const json = c.req.valid("json")

    const result = await new ResetAccountPassword(c).run({
      session: session,
      accountId: accountId.data,
      newPassword: json.new_password,
      now: c.env.NOW === undefined ? Date.now() : Date.parse(c.env.NOW),
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    return c.body(null, 204)
  },
)
