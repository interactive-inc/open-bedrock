import { CompanyResourceValidationError } from "@/contexts/company/domain/core/company-resource-validation-error"
import { isCompanyIdentifier } from "@/contexts/company/domain/core/is-company-identifier"
import { validateCompanyResource } from "@/contexts/company/domain/core/validate-company-resource"
import type { CompanyResourceChange } from "@/contexts/company/domain/core/company-resource"

export function validateCompanyResourceChange(
  change: CompanyResourceChange,
): CompanyResourceValidationError | null {
  if (
    !isCompanyIdentifier(change.commandId) ||
    !isCompanyIdentifier(change.actorAccountId) ||
    !Number.isSafeInteger(change.expectedRevision) ||
    change.expectedRevision < 0 ||
    !Number.isSafeInteger(change.recordedAt) ||
    change.recordedAt < 0 ||
    change.reason.length < 1 ||
    change.reason.length > 2_000 ||
    change.reason.trim() !== change.reason ||
    change.resources.length < 1 ||
    change.resources.length > 100
  ) {
    return new CompanyResourceValidationError("invalid_change")
  }

  const organizationId = change.resources[0]?.organizationId
  const identities = new Set<string>()
  for (const resource of change.resources) {
    const error = validateCompanyResource(resource)
    if (error !== null) return error
    if (resource.organizationId !== organizationId) {
      return new CompanyResourceValidationError("invalid_change")
    }
    const identity = `${resource.type}\u0000${resource.id}`
    if (identities.has(identity)) return new CompanyResourceValidationError("invalid_change")
    identities.add(identity)
  }

  return null
}
