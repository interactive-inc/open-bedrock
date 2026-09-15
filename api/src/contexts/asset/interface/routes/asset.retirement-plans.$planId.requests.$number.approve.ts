import { createAssetRetirementDecisionHandlers } from "@/contexts/asset/interface/operations/create-asset-retirement-decision-handlers"
import { assetFactory } from "@/contexts/asset/interface/request-environment/asset-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = assetFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createAssetRetirementDecisionHandlers("approve"),
)
