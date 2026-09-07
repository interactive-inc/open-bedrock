import { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import type { OnboardingLifecycleDeliveryRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-lifecycle-delivery.repository"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"

type Context = Readonly<{
  repository: OnboardingLifecycleDeliveryRepository
  accountId: AccountId
  tokenVersion: number
  now: Date
}>

/** 失敗した入退社の配送を、元の発令と処理を保持して再投入する。 */
export class RequeueOnboardingLifecycleDelivery {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(jobId: string) {
    try {
      const source = await this.c.repository.findFailure(jobId)
      if (source instanceof Error)
        return new UnexpectedError("failed to read onboarding delivery", { cause: source })
      if (source === null)
        return new NotFoundError("failed onboarding delivery not found", "delivery_not_found")
      const job = SystemDeliveryEntity.create({
        id: crypto.randomUUID(),
        kind: "job",
        handlerKey: source.job.handlerKey,
        operationKey: source.job.operationKey,
        payloadDigest: source.job.payloadDigest,
        idempotencyKey: `dead-letter:${source.deadLetterId}`,
        status: "queued",
        attempt: 0,
        maxAttempts: source.job.maxAttempts,
        availableAt: this.c.now,
        leaseAccountId: null,
        leaseTokenHash: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        createdAt: this.c.now,
        updatedAt: this.c.now,
        completedAt: null,
      })
      if (job instanceof Error)
        return new UnexpectedError("failed to prepare onboarding retry", { cause: job })
      const saved = await this.c.repository.requeue({
        sourceJobId: source.job.id,
        actionId: source.actionId,
        deadLetterId: source.deadLetterId,
        job,
        accountId: this.c.accountId,
        tokenVersion: this.c.tokenVersion,
        now: this.c.now,
      })
      if (saved === "forbidden")
        return new ForbiddenError("cannot retry onboarding delivery", "forbidden")
      if (saved === "conflict" || saved === "not_found")
        return new ConflictError("onboarding delivery changed", "delivery_conflict")
      if (saved instanceof Error)
        return new UnexpectedError("failed to retry onboarding delivery", { cause: saved })
      return saved
    } catch (cause) {
      return new UnexpectedError("failed to retry onboarding delivery", { cause })
    }
  }
}
