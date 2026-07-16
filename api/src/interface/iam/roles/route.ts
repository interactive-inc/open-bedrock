import { CreateRole } from "@/application/iam/create-role"
import { ListRoles } from "@/application/iam/list-roles"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppRole, zAppRoleList } from "@/lib/app-schemas"
import { codeSchema } from "@/lib/schemas"
import { z } from "zod"

// GET /roles — ロール一覧（iam:manage_roles または iam:assign_roles が必要）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await new ListRoles(c).run({ session: session })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  const responseBody = zAppRoleList.parse({
    data: result.map(({ role, permissionKeys }) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      is_system: role.isSystem === 1,
      permission_keys: [...permissionKeys],
    })),
    total: result.length,
  })

  return c.json(responseBody, 200)
})

// POST /roles — 動的ロールの作成（iam:manage_roles が必要）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      key: codeSchema,
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

    const json = c.req.valid("json")

    const created = await new CreateRole(c).run({
      session: session,
      key: json.key,
      name: json.name,
      description: json.description,
      permissionKeys: json.permission_keys,
      now: c.env.NOW === undefined ? Date.now() : Date.parse(c.env.NOW),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppRole.parse({
      id: created.id,
      key: created.key,
      name: created.name,
      description: created.description,
      is_system: created.isSystem === 1,
      permission_keys: [...json.permission_keys],
    })

    return c.json(responseBody, 201)
  },
)
