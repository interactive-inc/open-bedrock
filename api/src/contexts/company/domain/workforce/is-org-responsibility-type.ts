import type { OrgResponsibilityType } from "@/contexts/company/domain/workforce/org-responsibility-type"

/** Company responsibility codeは表示名やSystem roleではなく、安定した大文字tokenで表す。 */
export function isOrgResponsibilityType(value: string): value is OrgResponsibilityType {
  return /^[A-Z][A-Z0-9_]{0,63}$/.test(value)
}
