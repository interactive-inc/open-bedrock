import { timingSafeStringEqual } from "@/contexts/system/infrastructure/auth/timing-safe-string-equal.repository"
import { isPlaceholderSecret } from "@/lib/config/is-placeholder-secret"
import { UnauthorizedError } from "@/lib/http/errors"
import { factory } from "@/api/http/factory"

/**
 * プロビジョニング（外部 identity の同期）専用の machine API キー認証。
 * `Authorization: Bearer <key>` を PROVISIONING_API_KEY と定数時間比較する。
 * PROVISIONING_API_KEY が未設定、または公開済みの例示値のままの環境では
 * 全リクエストを拒否する（安全側に倒す）。
 * 既存のユーザー Bearer（verify-bearer）とは独立で、session は載せない。
 */
export const verifyProvisioningKey = factory.createMiddleware(async (c, next) => {
  const configured = c.env.PROVISIONING_API_KEY

  if (configured === undefined || configured.length === 0) {
    throw new UnauthorizedError("provisioning is not configured")
  }

  // 例示値のままなら誰でも鍵を知っている。未設定と同じく機能ごと閉じる。
  if (isPlaceholderSecret(configured)) {
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
