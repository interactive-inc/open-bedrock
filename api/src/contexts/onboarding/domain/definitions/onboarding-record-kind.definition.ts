import { z } from "zod"

export const onboardingRecordKinds = [
  "onboarding-template-record",
  "onboarding-template-task-record",
  "onboarding-assignment-record",
  "onboarding-task-record",
  "onboarding-lifecycle-delivery-record",
  "onboarding-lifecycle-template-binding-record",
] as const

/** 保全対象の記録種別の組を変えたら上げ、古い組で作った撤去計画を拒否する。 */
export const onboardingRecordCapabilityRevision = 2

export const onboardingRecordKindSchema = z.enum(onboardingRecordKinds)
export type OnboardingRecordKind = z.infer<typeof onboardingRecordKindSchema>

/** 空文字や区切り文字を含む複合主キーを損失なく表す。 */
export function encodeOnboardingTemplateTaskRecordId(templateCode: string, code: string): string {
  return `task:${templateCode.length}:${templateCode}${code}`
}

export function decodeOnboardingTemplateTaskRecordId(recordId: string) {
  const match = /^task:(0|[1-9]\d*):/u.exec(recordId)
  if (!match) return null
  const length = Number(match[1])
  if (!Number.isSafeInteger(length)) return null
  const remainder = recordId.slice(match[0].length)
  if (length > remainder.length) return null
  const templateCode = remainder.slice(0, length)
  const code = remainder.slice(length)
  if (encodeOnboardingTemplateTaskRecordId(templateCode, code) !== recordId) return null
  return { templateCode, code }
}
