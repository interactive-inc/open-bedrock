import { DeleteRole } from "@/application/iam/delete-role"
import { GetRole } from "@/application/iam/get-role"
import { UpdateRole } from "@/application/iam/update-role"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppRoleDetail } from "@/lib/app-schemas"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** GET /roles/:id — ロール詳細（割当 permission 付き、iam:manage_roles が必要） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const roleId = validateIntParam(c.req.param("id"), "role")

  const result = await new GetRole(c).run({ session: session, roleId: roleId })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  const responseBody = zAppRoleDetail.parse({
    id: result.role.id,
    key: result.role.key,
    name: result.role.name,
    description: result.role.description,
    is_system: result.role.isSystem === 1,
    permission_keys: [...result.permissionKeys],
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** PATCH /roles/:id — ロールの名前・説明・権限を更新（iam:manage_roles が必要） */
export const PATCH = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(1000).nullable(),
      permission_keys: z.array(z.string()),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const roleId = validateIntParam(c.req.param("id"), "role")

    const json = c.req.valid("json")

    const result = await new UpdateRole(c).run({
      session: session,
      roleId: roleId,
      name: json.name,
      description: json.description,
      permissionKeys: json.permission_keys,
      now: c.env.NOW === undefined ? Date.now() : Date.parse(c.env.NOW),
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    return c.body(null, 204)
  },
)

// @authorization service - session を application service に渡して判定する
/** DELETE /roles/:id — 動的ロールを削除（iam:manage_roles が必要） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const roleId = validateIntParam(c.req.param("id"), "role")

  const result = await new DeleteRole(c).run({ session: session, roleId: roleId })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
