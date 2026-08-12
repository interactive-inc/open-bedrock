import { CreateDepartment } from "@/contexts/company/application/organization/create-department"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppDepartmentDefinition } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /department-definitions — 部署マスタを新規登録する（org:manage） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.strictObject({
      name: z.string().trim().min(1).max(200),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const department = await new CreateDepartment(c).run({
      session,
      name: json.name,
    })

    if (department instanceof ApplicationError) {
      throw toHttpException(department)
    }

    const responseBody = zAppDepartmentDefinition.parse({
      id: department.id,
      name: department.name,
    })

    return c.json(responseBody, 201)
  },
)
