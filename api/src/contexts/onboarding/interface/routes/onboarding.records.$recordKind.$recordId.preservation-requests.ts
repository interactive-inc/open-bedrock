import { createOnboardingPreservationSubmissionHandlers } from "@/contexts/onboarding/interface/operations/create-onboarding-preservation-submission-handlers"
import { onboardingFactory } from "@/contexts/onboarding/interface/request-environment/onboarding-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原記録の管理資格、本文、Company候補を保存時にも検査する
export const POST = onboardingFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createOnboardingPreservationSubmissionHandlers("create"),
)
