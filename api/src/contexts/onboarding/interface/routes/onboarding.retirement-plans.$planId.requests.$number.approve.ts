import { createOnboardingRetirementDecisionHandlers } from "@/contexts/onboarding/interface/operations/create-onboarding-retirement-decision-handlers"
import { onboardingFactory } from "@/contexts/onboarding/interface/request-environment/onboarding-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 現在の人間の認証とCompanyの承認資格でSystemの判断を記録する
export const POST = onboardingFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createOnboardingRetirementDecisionHandlers("approve"),
)
