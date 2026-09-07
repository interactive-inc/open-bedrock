import { OnboardingLifecycleDeliveryRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-lifecycle-delivery.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import { SystemForbiddenError } from "@system/interface/errors"
import { factory } from "@/api/http/factory"
import { InternalError } from "@/lib/http/errors"
import { zAppOnboardingLifecycleDeliveryList } from "@/contexts/onboarding/interface/http/response-schemas"

// @authorization permission onboarding:manage - 入退社の配送状態と処理結果を確認する
export const GET = factory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!authorizeSystemOperation(context.var.permissions, "onboarding:manage", context.var.now()))
    throw new SystemForbiddenError()
  const deliveries = await new OnboardingLifecycleDeliveryRepository(context).findMany()
  if (deliveries instanceof Error) throw new InternalError("failed to load onboarding deliveries")
  return context.json(zAppOnboardingLifecycleDeliveryList.parse({ data: deliveries }), 200)
})
