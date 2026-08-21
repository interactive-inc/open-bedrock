import { InvalidCompanyActorError } from "@/contexts/company/domain/errors"

export const companyCapabilities = ["company:read", "company:write", "company:admin"] as const

export type CompanyCapability = (typeof companyCapabilities)[number]

export type CompanyActorProps = Readonly<{
  accountId: string
  employeeId: string | null
  organizationIds: ReadonlyArray<string>
  capabilities: ReadonlyArray<CompanyCapability>
}>

function isOpaqueIdentifier(value: string): boolean {
  return value.length >= 1 && value.length <= 256 && value.trim() === value
}

/** 認証結果からCompanyへ渡す、検証済みかつ変更不能な実行主体。 */
export class CompanyActorValue {
  readonly accountId: string
  readonly employeeId: string | null
  readonly organizationIds: ReadonlyArray<string>
  readonly capabilities: ReadonlyArray<CompanyCapability>

  private constructor(props: CompanyActorProps) {
    this.accountId = props.accountId
    this.employeeId = props.employeeId
    this.organizationIds = Object.freeze([...props.organizationIds])
    this.capabilities = Object.freeze([...props.capabilities])
    Object.freeze(this)
  }

  static restore(props: CompanyActorProps): CompanyActorValue {
    if (
      !isOpaqueIdentifier(props.accountId) ||
      (props.employeeId !== null && !isOpaqueIdentifier(props.employeeId)) ||
      props.organizationIds.length === 0 ||
      props.organizationIds.some(
        (organizationId) => organizationId !== "*" && !isOpaqueIdentifier(organizationId),
      ) ||
      new Set(props.organizationIds).size !== props.organizationIds.length ||
      props.capabilities.some((capability) => !companyCapabilities.includes(capability)) ||
      new Set(props.capabilities).size !== props.capabilities.length
    ) {
      throw new InvalidCompanyActorError()
    }

    return new CompanyActorValue(props)
  }

  canAccessOrganization(organizationId: string): boolean {
    return this.organizationIds.includes(organizationId) || this.organizationIds.includes("*")
  }

  hasCapability(capability: CompanyCapability): boolean {
    return this.capabilities.includes("company:admin") || this.capabilities.includes(capability)
  }
}
