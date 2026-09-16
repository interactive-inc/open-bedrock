import { governanceRecordFactory } from "@/contexts/governance/interface/request-environment/governance-record-factory"
import { createGovernanceSourceFreezeReadHandlers } from "@/contexts/governance/interface/operations/create-governance-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = governanceRecordFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createGovernanceSourceFreezeReadHandlers(),
)
