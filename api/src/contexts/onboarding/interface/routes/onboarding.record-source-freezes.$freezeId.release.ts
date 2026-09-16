import { onboardingFactory } from "@/contexts/onboarding/interface/request-environment/onboarding-factory"
import { createOnboardingSourceFreezeHandlers } from "@/contexts/onboarding/interface/operations/create-onboarding-source-freeze-handlers"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 人の技術管理権限と再認証を解除時にも検査する
export const POST = onboardingFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createOnboardingSourceFreezeHandlers("release"),
)
