import { PERMISSION_CATALOG } from "@/api/http/permissions/permission.catalog"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
import { zAppPermissionList } from "@/lib/app-schemas"

// @authorization permission - 権限キーで判定する
/**
 * GET /permission-definitions — 製品権限カタログ全件（iam:write が必要）。
 * ロール編集 UI の checkbox とカテゴリ表示に使う。正はコードの PERMISSION_CATALOG。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (
    session.hasPermission("system:admin") === false &&
    session.hasPermission("iam:write") === false
  ) {
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
