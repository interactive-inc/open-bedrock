import { createCareerPreservationSubmissionHandlers } from "@/contexts/career/interface/operations/create-career-preservation-submission-handlers"
import { careerFactory } from "@/contexts/career/interface/request-environment/career-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = careerFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createCareerPreservationSubmissionHandlers("resubmit"),
)
