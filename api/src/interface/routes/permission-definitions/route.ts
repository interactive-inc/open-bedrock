import { PERMISSION_CATALOG } from "@/lib/auth/permission-keys"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppPermissionList } from "@/lib/app-schemas"

/**
 * GET /permission-definitions — 権限カタログ全件（iam:manage_roles が必要）。
 * ロール編集 UI の checkbox とカテゴリ表示に使う。正はコードの PERMISSION_CATALOG。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("iam:manage_roles") === false) {
    throw new ForbiddenError("cannot manage roles")
  }

  const responseBody = zAppPermissionList.parse({
    data: PERMISSION_CATALOG.map((entry) => ({
      key: entry.key,
      description: entry.description,
      category: entry.category,
    })),
    total: PERMISSION_CATALOG.length,
  })

  return c.json(responseBody, 200)
})
