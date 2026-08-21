import { applyOrganizationWorkforceChanges } from "@/contexts/company/infrastructure/workforce/apply-organization-workforce-changes.repository"
import { countOrganizationChangePeriods } from "@/contexts/company/domain/workforce/count-organization-change-periods"
import { hasValidOrganizationChangeAuditMetadata } from "@/contexts/company/domain/workforce/has-valid-organization-change-audit-metadata"
import { OrganizationChangeValidationError } from "@/contexts/company/domain/workforce/organization-change-validation-error"
import { organizationChangeHasCanonicalOperation } from "@/contexts/company/domain/workforce/organization-change-has-canonical-operation"
import type {
  OrganizationChangeReadPorts,
  OrganizationChangeSet,
  ValidateOrganizationChangeResult,
} from "@/contexts/company/domain/workforce/organization-change"
import { replaceOrganizationChangePeriods } from "@/contexts/company/domain/workforce/replace-organization-change-periods"
import { validateOrganizationChangeIdentities } from "@/contexts/company/domain/workforce/validate-organization-change-identities"
import { validateOrganizationUnitSnapshot } from "@/contexts/company/domain/workforce/validate-organization-unit-snapshot"
import { validateWorkforceSchedules } from "@/contexts/company/domain/workforce/validate-workforce-schedules"

export class ValidateOrganizationChange {
  constructor(private readonly ports: OrganizationChangeReadPorts) {
    Object.freeze(this)
  }

  async execute(change: OrganizationChangeSet): Promise<ValidateOrganizationChangeResult> {
    const changes = countOrganizationChangePeriods(change)
    if (changes === 0) {
      return { kind: "invalid", error: new OrganizationChangeValidationError("empty_change") }
    }
    if (!organizationChangeHasCanonicalOperation(change)) {
      return {
        kind: "invalid",
        error: new OrganizationChangeValidationError("invalid_operation"),
      }
    }
    if (!hasValidOrganizationChangeAuditMetadata(change)) {
      return {
        kind: "invalid",
        error: new OrganizationChangeValidationError("invalid_audit"),
      }
    }

    let organization
    let workforce
    try {
      organization = await this.ports.organization.readSnapshot(change.asOf)
      workforce = await this.ports.workforce.readAllSnapshot()
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
    if (!organization.ok) return { kind: "unavailable", cause: organization.cause }
    if (!workforce.ok) return { kind: "unavailable", cause: workforce.cause }
    if (organization.snapshot.revision !== change.expectedRevision) {
      return { kind: "conflict", actualRevision: organization.snapshot.revision }
    }

    const identityError = validateOrganizationChangeIdentities(organization.snapshot.units, change)
    if (identityError !== null) return { kind: "invalid", error: identityError }

    const units = replaceOrganizationChangePeriods(organization.snapshot.units, change.unitPeriods)
    if (units instanceof OrganizationChangeValidationError) {
      return { kind: "invalid", error: units }
    }
    const organizationError = validateOrganizationUnitSnapshot({
      revision: change.expectedRevision + changes,
      asOf: change.asOf,
      units,
    })
    if (organizationError !== null) {
      return {
        kind: "invalid",
        error: new OrganizationChangeValidationError("invalid_organization"),
      }
    }

    const schedules = applyOrganizationWorkforceChanges(workforce.schedules, change)
    if (schedules instanceof OrganizationChangeValidationError) {
      return { kind: "invalid", error: schedules }
    }
    if (validateWorkforceSchedules({ schedules, organizationUnitPeriods: units }) !== null) {
      return {
        kind: "invalid",
        error: new OrganizationChangeValidationError("invalid_workforce"),
      }
    }

    return { kind: "valid", resultingRevision: change.expectedRevision + changes }
  }
}
