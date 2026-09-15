import { createAssetPreservationSubmissionHandlers } from "@/contexts/asset/interface/operations/create-asset-preservation-submission-handlers"
import { assetFactory } from "@/contexts/asset/interface/request-environment/asset-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = assetFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAssetPreservationSubmissionHandlers("create"),
)
