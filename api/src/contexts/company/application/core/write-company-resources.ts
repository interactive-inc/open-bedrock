import { canAccessCompanyOrganization } from "@/contexts/company/application/core/can-access-company-organization"
import type { CompanyActor } from "@/contexts/company/application/core/company-actor"
import type {
  CompanyResourceWriteResult,
  WriteCompanyResourcePersistence,
} from "@/contexts/company/application/core/company-resource-persistence"
import { hasCompanyCapability } from "@/contexts/company/application/core/has-company-capability"
import { CompanyResourceValidationError } from "@/contexts/company/domain/core/company-resource-validation-error"
import { validateCompanyResourceChange } from "@/contexts/company/domain/core/validate-company-resource-change"
import type {
  CompanyResourceChange,
  CompanyResourceType,
} from "@/contexts/company/domain/core/company-resource"

export type WriteCompanyResourcesResult =
  | CompanyResourceWriteResult
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "invalid"; error: CompanyResourceValidationError }>

export async function writeCompanyResources(
  actor: CompanyActor,
  change: Omit<CompanyResourceChange, "actorAccountId">,
  allowedTypes: ReadonlyArray<CompanyResourceType>,
  write: WriteCompanyResourcePersistence,
): Promise<WriteCompanyResourcesResult> {
  const organizationId = change.resources[0]?.organizationId ?? ""
  if (
    !canAccessCompanyOrganization(actor, organizationId) ||
    !hasCompanyCapability(actor, "company:write")
  ) {
    return { kind: "forbidden" }
  }

  const command: CompanyResourceChange = { ...change, actorAccountId: actor.accountId }
  const error = validateCompanyResourceChange(command)
  if (
    error !== null ||
    command.resources.some((resource) => !allowedTypes.includes(resource.type))
  ) {
    return {
      kind: "invalid",
      error: error ?? new CompanyResourceValidationError("invalid_resource"),
    }
  }

  try {
    return await write(command)
  } catch (cause) {
    return { kind: "unavailable", cause }
  }
}
