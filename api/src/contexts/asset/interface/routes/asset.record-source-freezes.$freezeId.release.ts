import { assetFactory } from "@/contexts/asset/interface/request-environment/asset-factory"
import { createAssetSourceFreezeHandlers } from "@/contexts/asset/interface/operations/create-asset-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = assetFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAssetSourceFreezeHandlers("release"),
)
