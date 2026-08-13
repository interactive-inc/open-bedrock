import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppFeatureAvailability } from "@/lib/app-schemas"
import { resolveDisabledFeatureKeys } from "@/lib/feature/resolve-disabled-feature-keys"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/**
 * GET /features — 機能ゲートの現在の状態（無効な機能キーの一覧）。
 * web がナビゲーションと画面の出し分けに使う。強制自体は各ルート前段の feature gate が担う。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const responseBody = zAppFeatureAvailability.parse({
    disabled_features: resolveDisabledFeatureKeys({
      enabledOptionalFeatures: c.env.ENABLED_OPTIONAL_FEATURES,
      disabledStandardFeatures: c.env.DISABLED_STANDARD_FEATURES,
    }),
  })

  return c.json(responseBody, 200)
})
