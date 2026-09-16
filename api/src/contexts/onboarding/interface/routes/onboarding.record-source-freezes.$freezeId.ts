import { onboardingFactory } from "@/contexts/onboarding/interface/request-environment/onboarding-factory"
import { createOnboardingSourceFreezeReadHandlers } from "@/contexts/onboarding/interface/operations/create-onboarding-source-freeze-read-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の現在の技術管理権限を読取時にも検査する
export const GET = onboardingFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createOnboardingSourceFreezeReadHandlers(),
)
