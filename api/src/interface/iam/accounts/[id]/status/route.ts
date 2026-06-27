import { SetAccountStatus } from "@/application/iam/set-account-status"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { accountStatusSchema } from "@/lib/schemas"
import { z } from "zod"

// POST /accounts/:id/status — アカウントの状態を変更（account:manage が必要）。停止・ロック・有効化。
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ status: accountStatusSchema })),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const accountId = validateIntParam(c.req.param("id"), "account")

    const json = c.req.valid("json")

    const result = await new SetAccountStatus(c).run({
      session: session,
      accountId: accountId,
      status: json.status,
      now: c.env.NOW === undefined ? Date.now() : Date.parse(c.env.NOW),
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    return c.body(null, 204)
  },
)
