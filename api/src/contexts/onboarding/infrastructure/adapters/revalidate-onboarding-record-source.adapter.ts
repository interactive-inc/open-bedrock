import type { OnboardingContext } from "@/contexts/onboarding/configuration/onboarding-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CaptureOnboardingRecordAdapter } from "@/contexts/onboarding/infrastructure/adapters/capture-onboarding-record.adapter"
import { OnboardingError } from "@/contexts/onboarding/domain/errors"
import { onboardingRecordKindSchema } from "@/contexts/onboarding/domain/definitions/onboarding-record-kind.definition"

type Context = OnboardingContext & Readonly<{ sourceNamespace: string }>

/** 承認対象の原記録を現在の管理資格で再取得し、確定までの変更を検出する。 */
export class RevalidateOnboardingRecordSourceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(source: PreservedRecordSourceValue) {
    if (
      source.props.sourceNamespace !== this.c.sourceNamespace ||
      source.props.ownerContext !== "onboarding"
    )
      return new OnboardingError(
        "forbidden",
        "record source does not belong to this onboarding registry",
      )

    const recordKind = onboardingRecordKindSchema.safeParse(source.props.recordKind)
    if (!recordKind.success)
      return new OnboardingError("forbidden", "invalid onboarding record kind")
    const current = await new CaptureOnboardingRecordAdapter(this.c).prepare({
      recordKind: recordKind.data,
      recordId: source.props.recordId,
      sourceNamespace: this.c.sourceNamespace,
    })
    if (current instanceof Error) return current
    if (
      !source.matchesSource(current.source) ||
      Date.parse(source.props.capturedAt) > Date.parse(current.source.props.capturedAt)
    )
      return new OnboardingError(
        "onboarding_conflict",
        "onboarding record differs from preservation proposal",
      )

    return Object.freeze({
      source,
      content: current.content,
      actorAccountId: current.actorAccountId,
      sourceAuthorizationRef: current.sourceAuthorizationRef,
      assertions: Object.freeze(current.assertions),
    })
  }
}
