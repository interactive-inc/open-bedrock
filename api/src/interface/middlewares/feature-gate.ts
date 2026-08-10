import type { HonoEnv } from "@/env"
import { NotFoundError } from "@/interface/lib/errors"
import { resolveDisabledRoutePrefixes } from "@/lib/feature/resolve-disabled-route-prefixes"
import { createMiddleware } from "hono/factory"

/**
 * 無効化されている機能のルートを 404 で遮断する。
 * 機能の存在自体を漏らさないため 403 ではなく 404 を返す。
 * 対応表は lib/feature/feature-route-registry.ts、切替は環境変数
 * ENABLED_OPTIONAL_FEATURES / DISABLED_STANDARD_FEATURES（.docs/feature-tiers.md が正本）。
 */
export const featureGate = createMiddleware<HonoEnv>(async (c, next) => {
  const disabledPrefixes = resolveDisabledRoutePrefixes({
    enabledOptionalFeatures: c.env.ENABLED_OPTIONAL_FEATURES,
    disabledStandardFeatures: c.env.DISABLED_STANDARD_FEATURES,
  })

  const path = c.req.path

  for (const prefix of disabledPrefixes) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      throw new NotFoundError("not found")
    }
  }

  await next()
})
