import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import { SystemForbiddenError } from "@system/interface/errors"
import { RequeueOnboardingLifecycleDelivery } from "@/contexts/onboarding/application/requeue-onboarding-lifecycle-delivery"
import { OnboardingLifecycleDeliveryRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-lifecycle-delivery.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { factory } from "@/api/http/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - 人の管理者がstep-up後に入退社の失敗配送を再投入する
export const POST = factory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", z.object({ jobId: z.string().regex(/^\S{1,255}$/) }).strict()),
  async (context) => {
    if (
      !["onboarding:manage", "batch:write", "system:admin"].every((permission) =>
        authorizeSystemOperation(context.var.permissions, permission, context.var.now()),
      )
    )
      throw new SystemForbiddenError()
    const saved = await new RequeueOnboardingLifecycleDelivery({
      repository: new OnboardingLifecycleDeliveryRepository(context),
      accountId: zAccountId.parse(context.var.userId),
      tokenVersion: context.var.accountTokenVersion,
      now: context.var.now(),
    }).execute(context.req.valid("param").jobId)
    if (saved instanceof ApplicationError) throw toHttpException(saved)
    return context.json(
      { job_id: saved.jobId, replayed: saved.status === "replayed" },
      saved.status === "replayed" ? 200 : 201,
    )
  },
)
