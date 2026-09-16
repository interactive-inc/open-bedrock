import { DomainError } from "@system/domain/errors"

export type OnboardingErrorCode = "forbidden" | "onboarding_conflict" | "onboarding_unavailable"

/** onboarding原記録の保全操作が成立しない理由。 */
export class OnboardingError extends DomainError {
  constructor(
    readonly code: OnboardingErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "OnboardingError"
  }
}
