import type {
  OrganizationInvariantCode,
  OrganizationInvariantViolation,
} from "@/contexts/company/domain/workforce/organization-invariant"

export function createOrganizationInvariantViolation(
  code: OrganizationInvariantCode,
  message: string,
): OrganizationInvariantViolation {
  return { code, message }
}
