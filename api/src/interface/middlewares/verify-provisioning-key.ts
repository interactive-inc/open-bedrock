import { timingSafeStringEqual } from "@/infrastructure/system/auth/timing-safe-string-equal"
import { UnauthorizedError } from "@/interface/lib/errors"
import { factory } from "@/interface/utils/factory"

/**
 * プロビジョニング（外部 identity の同期）専用の machine API キー認証。
 * `Authorization: Bearer <key>` を PROVISIONING_API_KEY と定数時間比較する。
 * PROVISIONING_API_KEY 未設定の環境では全リクエストを拒否する（安全側に倒す）。
 * 既存のユーザー Bearer（verify-bearer）とは独立で、session は載せない。
 */
export const verifyProvisioningKey = factory.createMiddleware(async (c, next) => {
  const configured = c.env.PROVISIONING_API_KEY

  if (configured === undefined || configured.length === 0) {
    throw new UnauthorizedError("provisioning is not configured")
  }

  const header = c.req.header("Authorization")

  if (header === undefined || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("missing provisioning key")
  }

  const presented = header.slice("Bearer ".length)

  const matches = await timingSafeStringEqual(presented, configured)

  if (!matches) {
    throw new UnauthorizedError("invalid provisioning key")
  }

  await next()
})
