import { factory } from "@/interface/utils/factory"

/** ライフサイクル系レスポンスにキャッシュ禁止ヘッダを付与する。 */
export const lifecycleNoStore = factory.createMiddleware(async (c, next) => {
  await next()
  if (
    c.req.path.includes("/lifecycle-events") ||
    c.req.path.includes("/lifecycle-state") ||
    c.req.path.startsWith("/personnel-actions")
  ) {
    c.header("Cache-Control", "no-store")
  }
})
