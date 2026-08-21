import {
  CompanyResourceEntity,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"

export type CompanyResourceChangeProps = Readonly<{
  commandId: string
  expectedRevision: number
  actorAccountId: string
  reason: string
  recordedAt: number
  resources: ReadonlyArray<CompanyResourceProps>
}>

export class CompanyResourceChangeEntity {
  readonly commandId: string
  readonly expectedRevision: number
  readonly actorAccountId: string
  readonly reason: string
  readonly recordedAt: number
  readonly resources: ReadonlyArray<CompanyResourceEntity>

  private constructor(
    props: Omit<CompanyResourceChangeProps, "resources"> &
      Readonly<{ resources: ReadonlyArray<CompanyResourceEntity> }>,
  ) {
    this.commandId = props.commandId
    this.expectedRevision = props.expectedRevision
    this.actorAccountId = props.actorAccountId
    this.reason = props.reason
    this.recordedAt = props.recordedAt
    this.resources = Object.freeze([...props.resources])
    Object.freeze(this)
  }

  static create(
    props: CompanyResourceChangeProps,
  ): CompanyResourceChangeEntity | CompanyResourceValidationError {
    if (
      !isCompanyIdentifier(props.commandId) ||
      !isCompanyIdentifier(props.actorAccountId) ||
      !Number.isSafeInteger(props.expectedRevision) ||
      props.expectedRevision < 0 ||
      !Number.isSafeInteger(props.recordedAt) ||
      props.recordedAt < 0 ||
      props.reason.length < 1 ||
      props.reason.length > 2_000 ||
      props.reason.trim() !== props.reason ||
      props.resources.length < 1 ||
      props.resources.length > 100
    ) {
      return new CompanyResourceValidationError("invalid_change")
    }

    const resources: CompanyResourceEntity[] = []
    for (const resourceProps of props.resources) {
      const resource = CompanyResourceEntity.create(resourceProps)
      if (resource instanceof CompanyResourceValidationError) return resource
      resources.push(resource)
    }

    const organizationId = resources[0]?.organizationId
    const identities = new Set<string>()
    for (const resource of resources) {
      if (resource.organizationId !== organizationId) {
        return new CompanyResourceValidationError("invalid_change")
      }
      const identity = `${resource.type}\u0000${resource.id}`
      if (identities.has(identity)) return new CompanyResourceValidationError("invalid_change")
      identities.add(identity)
    }

    return new CompanyResourceChangeEntity({ ...props, resources })
  }
}

function isCompanyIdentifier(value: string): boolean {
  return value.length >= 1 && value.length <= 255 && value.trim() === value && !/\s/.test(value)
}
