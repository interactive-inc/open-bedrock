import { GrantAccountRole } from "@/application/iam/grant-account-role"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { codeSchema } from "@/lib/schemas"
import { z } from "zod"

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
