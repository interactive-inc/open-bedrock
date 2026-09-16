import { createGovernanceRetirementDecisionHandlers } from "@/contexts/governance/interface/operations/create-governance-retirement-decision-handlers"
import { governanceRecordFactory } from "@/contexts/governance/interface/request-environment/governance-record-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = governanceRecordFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createGovernanceRetirementDecisionHandlers("reject"),
)
