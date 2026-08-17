import type {
  CompanyResource,
  CompanyResourceChange,
  CompanyResourceType,
} from "@/contexts/company/domain/core/company-resource"
import {
  CompanyResourceValidationError,
  isCompanyIdentifier,
  validateCompanyResourceChange,
} from "@/contexts/company/domain/core/company-resource"
import { isCalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type {
  CompanyResourceQuery,
  CompanyResourceReadResult,
  CompanyResourceRepository,
  CompanyResourceWriteResult,
} from "@/contexts/company/application/core/company-resource.repository"

export type CompanyCapability = "company:read" | "company:write" | "company:admin"

export type CompanyActor = Readonly<{
  accountId: string
  employeeId: string | null
  organizationIds: ReadonlyArray<string>
  capabilities: ReadonlyArray<CompanyCapability>
}>

export type ReadCompanyResourcesResult =
  | Readonly<{
      kind: "found"
      organizationRevision: number
      resources: ReadonlyArray<CompanyResource>
    }>
  | Readonly<{ kind: "invalid"; error: CompanyResourceValidationError }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

export type WriteCompanyResourcesResult =
  | CompanyResourceWriteResult
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "invalid"; error: CompanyResourceValidationError }>

function actorCanAccessOrganization(actor: CompanyActor, organizationId: string): boolean {
  return actor.organizationIds.includes(organizationId) || actor.organizationIds.includes("*")
}

function hasCapability(actor: CompanyActor, capability: CompanyCapability): boolean {
  return actor.capabilities.includes("company:admin") || actor.capabilities.includes(capability)
}

function isValidQuery(query: CompanyResourceQuery): boolean {
  return (
    isCompanyIdentifier(query.organizationId) &&
    query.types.length >= 1 &&
    query.types.length <= 100 &&
    new Set(query.types).size === query.types.length &&
    (query.ids === undefined ||
      (query.ids.length >= 1 &&
        query.ids.length <= 100 &&
        new Set(query.ids).size === query.ids.length &&
        query.ids.every(isCompanyIdentifier))) &&
    (query.effectiveOn === undefined || isCalendarDate(query.effectiveOn))
  )
}

/** Company coreのread/write認可とfail-closed validationを一箇所に固定する。 */
export class CompanyResourceService {
  constructor(private readonly repository: CompanyResourceRepository) {
    Object.freeze(this)
  }

  async read(
    actor: CompanyActor,
    query: CompanyResourceQuery,
  ): Promise<ReadCompanyResourcesResult> {
    if (!isValidQuery(query)) {
      return { kind: "invalid", error: new CompanyResourceValidationError("invalid_query") }
    }
    if (
      !actorCanAccessOrganization(actor, query.organizationId) ||
      !hasCapability(actor, "company:read")
    ) {
      return { kind: "forbidden" }
    }

    let result: CompanyResourceReadResult
    try {
      result = await this.repository.read(query)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
    return result.ok
      ? {
          kind: "found",
          organizationRevision: result.organizationRevision,
          resources: result.resources,
        }
      : { kind: "unavailable", cause: result.cause }
  }

  async write(
    actor: CompanyActor,
    change: Omit<CompanyResourceChange, "actorAccountId">,
    allowedTypes: ReadonlyArray<CompanyResourceType>,
  ): Promise<WriteCompanyResourcesResult> {
    const organizationId = change.resources[0]?.organizationId ?? ""
    if (
      !actorCanAccessOrganization(actor, organizationId) ||
      !hasCapability(actor, "company:write")
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
      return await this.repository.write(command)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}
