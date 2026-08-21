import { UpdateMyPhone } from "@/contexts/administration/application/employee/update-my-phone"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { zAppMyPhone } from "@/lib/app-schemas"
import { factory } from "@/api/http/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** PUT /me/phone — 本人が自己申告する電話番号を更新する */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      phone: z.string().max(30).nullable(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdateMyPhone(c).run({
      session,
      phone: json.phone,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppMyPhone.parse({ phone: updated.phone })

    return c.json(responseBody, 200)
  },
)
