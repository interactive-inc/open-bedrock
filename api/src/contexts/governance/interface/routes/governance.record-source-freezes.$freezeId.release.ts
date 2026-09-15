import { governanceFactory } from "@/contexts/governance/interface/request-environment/governance-factory"
import { createGovernanceSourceFreezeHandlers } from "@/contexts/governance/interface/operations/create-governance-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = governanceFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createGovernanceSourceFreezeHandlers("release"),
)
