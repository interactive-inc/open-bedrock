import { createSkillPreservationSubmissionHandlers } from "@/contexts/skill/interface/operations/create-skill-preservation-submission-handlers"
import { skillFactory } from "@/contexts/skill/interface/request-environment/skill-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = skillFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createSkillPreservationSubmissionHandlers("resubmit"),
)
