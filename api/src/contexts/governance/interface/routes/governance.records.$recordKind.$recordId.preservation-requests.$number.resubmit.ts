import { createGovernancePreservationSubmissionHandlers } from "@/contexts/governance/interface/operations/create-governance-preservation-submission-handlers"
import { governanceRecordFactory } from "@/contexts/governance/interface/request-environment/governance-record-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = governanceRecordFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createGovernancePreservationSubmissionHandlers("resubmit"),
)
