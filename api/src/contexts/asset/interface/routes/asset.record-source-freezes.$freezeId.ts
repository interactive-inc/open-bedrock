import { assetFactory } from "@/contexts/asset/interface/request-environment/asset-factory"
import { createAssetSourceFreezeReadHandlers } from "@/contexts/asset/interface/operations/create-asset-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = assetFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAssetSourceFreezeReadHandlers(),
)
