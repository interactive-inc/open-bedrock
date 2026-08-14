import { GrantAccountRole } from "@/contexts/company/application/iam/grant-account-role"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { codeSchema } from "@/lib/schemas"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /accounts/:id/roles — アカウントにロールを付与（iam:assign_roles が必要） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ role_key: codeSchema })),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const accountId = validateIntParam(c.req.param("id"), "account")

    const json = c.req.valid("json")

    const result = await new GrantAccountRole(c).run({
      session: session,
      accountId: accountId,
      roleKey: json.role_key,
      now: c.env.NOW === undefined ? Date.now() : Date.parse(c.env.NOW),
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    return c.body(null, 204)
  },
)
