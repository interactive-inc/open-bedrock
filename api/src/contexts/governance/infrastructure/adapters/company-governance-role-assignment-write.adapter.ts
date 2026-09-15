import { ApplyOrganizationChange } from "@/contexts/company/application/organization/apply-organization-change"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import {
  D1CompanyResourceRepository,
  type CompanyResourceWriteResult,
} from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

type Context = Readonly<{
  actor: CompanyActorValue
  database: D1Database
  auditStatements: ReadonlyArray<D1PreparedStatement>
}>

export type CompanyGovernanceRoleCardinality = "one" | "per_department" | "many"

export type AssignCompanyGovernanceRoleResult =
  | Readonly<{
      kind: "assigned"
      assignmentId: string
      organizationRevision: number
      replayed: boolean
    }>
  | Exclude<CompanyResourceWriteResult, Readonly<{ kind: "applied" }>>
  | Readonly<{ kind: "overlap" }>
  | Readonly<{ kind: "forbidden" }>

export type RevokeCompanyGovernanceRoleResult =
  | Readonly<{ kind: "revoked"; organizationRevision: number; replayed: boolean }>
  | Exclude<CompanyResourceWriteResult, Readonly<{ kind: "applied" }>>
  | Readonly<{ kind: "forbidden" }>

/** 規程の責務任命を、期待会社版に固定したCompany組織変更として保存する。 */
export class CompanyGovernanceRoleAssignmentWriteAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async assign(props: {
    organizationId: string
    commandId: string
    expectedRevision: number
    responsibilityCode: string
    responsibilityName: string
    cardinality: CompanyGovernanceRoleCardinality
    employeeCode: string
    departmentCode: string | null
    startsOn: CalendarDate
    endsOn: CalendarDate | null
    sourceDocumentCode: string | null
    recordedAt: number
    voided?: boolean
    prepareAdditionalStatements?: (assignment: {
      assignmentId: string
      resourceRevision: 1 | 2
      expectedRevision: number
      organizationRevision: number
      actorAccountId: string
      reason: string
      recordedAt: number
    }) => ReadonlyArray<D1PreparedStatement>
  }): Promise<AssignCompanyGovernanceRoleResult> {
    const snapshotRepository = new D1CompanyResourceRepository(this.c.database)
    const snapshot = await snapshotRepository.findMany({
      organizationId: props.organizationId,
      organizationRevision: props.expectedRevision,
      types: [
        "employee",
        "organization-unit",
        "responsibility",
        "authority-scope",
        "responsibility-assignment",
      ],
    })
    if (!snapshot.ok) return { kind: "unavailable", cause: snapshot.cause }
    if (snapshot.organizationRevision !== props.expectedRevision) {
      return { kind: "conflict", actualRevision: snapshot.organizationRevision }
    }

    const employees = snapshot.resources.filter(
      (resource) =>
        resource.type === "employee" &&
        resource.readNullableText("employeeCode") === props.employeeCode,
    )
    if (employees.length !== 1) return { kind: "invalid", error: invalidResource() }
    const employee = employees[0]
    if (employee === undefined) return { kind: "invalid", error: invalidResource() }

    const departments = snapshot.resources.filter(
      (resource) =>
        resource.type === "organization-unit" && resource.readText("code") === props.departmentCode,
    )
    if (
      (props.departmentCode === null && departments.length !== 0) ||
      (props.departmentCode !== null && departments.length !== 1)
    ) {
      return { kind: "invalid", error: invalidResource() }
    }
    const department = departments[0]
    const organizationUnitId = department?.readText("organizationUnitId") ?? null
    if (props.departmentCode !== null && organizationUnitId === null) {
      return { kind: "invalid", error: invalidResource() }
    }

    const definitions = snapshot.resources.filter(
      (resource) =>
        resource.type === "responsibility" &&
        resource.readText("code") === props.responsibilityCode,
    )
    if (definitions.length > 1) return { kind: "invalid", error: invalidResource() }
    const definition = definitions[0]
    const responsibilityId =
      definition?.id ??
      `responsibility:governance:${await fingerprint([props.organizationId, props.responsibilityCode])}`
    const scopes =
      organizationUnitId === null
        ? []
        : snapshot.resources.filter(
            (resource) =>
              resource.type === "authority-scope" &&
              resource.readText("scopeType") === "organization-unit" &&
              resource.readText("scopeId") === organizationUnitId,
          )
    if (scopes.length > 1) return { kind: "invalid", error: invalidResource() }
    const authorityScopeId =
      organizationUnitId === null
        ? null
        : (scopes[0]?.id ??
          `authority-scope:governance:${await fingerprint([props.organizationId, organizationUnitId])}`)

    const overlaps = snapshot.resources.filter(
      (resource) =>
        resource.type === "responsibility-assignment" &&
        resource.readText("responsibilityId") === responsibilityId &&
        (resource.effectiveTo === null || props.startsOn < resource.effectiveTo) &&
        (props.endsOn === null || resource.effectiveFrom < props.endsOn),
    )
    const conflicts = overlaps.some((assignment) => {
      if (props.cardinality === "one") return true
      if (props.cardinality === "per_department") {
        return assignment.readNullableText("authorityScopeId") === authorityScopeId
      }
      return (
        assignment.readText("holderType") === "employee" &&
        assignment.readText("holderId") === employee.id &&
        assignment.readNullableText("authorityScopeId") === authorityScopeId
      )
    })
    if (conflicts) return { kind: "overlap" }

    const resources: CompanyResourceProps[] = []
    if (definition === undefined) {
      resources.push({
        organizationId: props.organizationId,
        type: "responsibility",
        id: responsibilityId,
        revision: 1,
        state: "active",
        effectiveFrom: props.startsOn,
        effectiveTo: null,
        attributes: { code: props.responsibilityCode, officialName: props.responsibilityName },
      })
    } else if (definition.effectiveFrom > props.startsOn) {
      resources.push({
        ...definition.toProps(),
        revision: definition.revision + 1,
        effectiveFrom: props.startsOn,
      })
    }
    if (organizationUnitId !== null && scopes[0] === undefined && authorityScopeId !== null) {
      resources.push({
        organizationId: props.organizationId,
        type: "authority-scope",
        id: authorityScopeId,
        revision: 1,
        state: "active",
        effectiveFrom: props.startsOn,
        effectiveTo: null,
        attributes: { scopeType: "organization-unit", scopeId: organizationUnitId },
      })
    }
    const assignmentId = `responsibility-assignment:governance:${await fingerprint([
      props.organizationId,
      props.commandId,
    ])}`
    const reason =
      props.sourceDocumentCode === null
        ? `Assign ${props.responsibilityCode} responsibility`
        : `Assign ${props.responsibilityCode} responsibility from ${props.sourceDocumentCode}`
    const additionalStatements =
      props.prepareAdditionalStatements?.({
        assignmentId,
        resourceRevision: props.voided === true ? 2 : 1,
        expectedRevision: props.expectedRevision,
        organizationRevision: props.expectedRevision + 1,
        actorAccountId: this.c.actor.accountId,
        reason,
        recordedAt: props.recordedAt,
      }) ?? []
    const repository = new D1CompanyResourceRepository(this.c.database, [
      ...this.c.auditStatements,
      ...additionalStatements,
    ])
    const assignment: CompanyResourceProps = {
      organizationId: props.organizationId,
      type: "responsibility-assignment",
      id: assignmentId,
      revision: 1,
      state: "active",
      effectiveFrom: props.startsOn,
      effectiveTo: props.endsOn,
      attributes: {
        responsibilityId,
        holderType: "employee",
        holderId: employee.id,
        authorityScopeId,
        delegationAllowed: false,
      },
    }
    resources.push(assignment)
    if (props.voided === true) resources.push({ ...assignment, revision: 2, state: "void" })

    const application = new ApplyOrganizationChange({ actor: this.c.actor, repository })
    const change = {
      commandId: props.commandId,
      expectedRevision: props.expectedRevision,
      reason,
      recordedAt: props.recordedAt,
      resources,
    }
    const written =
      props.voided === true
        ? await application.executeHistory(change)
        : await application.execute(change)
    return written.kind === "applied"
      ? {
          kind: "assigned",
          assignmentId,
          organizationRevision: written.organizationRevision,
          replayed: written.replayed,
        }
      : written
  }

  async revoke(props: {
    organizationId: string
    commandId: string
    expectedRevision: number
    assignmentId: string
    recordedAt: number
  }): Promise<RevokeCompanyGovernanceRoleResult> {
    const repository = new D1CompanyResourceRepository(this.c.database, this.c.auditStatements)
    const snapshot = await repository.findMany({
      organizationId: props.organizationId,
      organizationRevision: props.expectedRevision,
      types: ["responsibility-assignment"],
      ids: [props.assignmentId],
    })
    if (!snapshot.ok) return { kind: "unavailable", cause: snapshot.cause }
    const assignment = snapshot.resources[0]
    if (
      snapshot.resources.length !== 1 ||
      assignment === undefined ||
      assignment.type !== "responsibility-assignment"
    ) {
      return { kind: "invalid", error: invalidResource() }
    }
    const written = await new ApplyOrganizationChange({ actor: this.c.actor, repository }).execute({
      commandId: props.commandId,
      expectedRevision: props.expectedRevision,
      reason: `Revoke governance responsibility assignment ${props.assignmentId}`,
      recordedAt: props.recordedAt,
      resources: [
        {
          ...assignment.toProps(),
          revision: assignment.revision + 1,
          state: "void",
        },
      ],
    })
    return written.kind === "applied"
      ? {
          kind: "revoked",
          organizationRevision: written.organizationRevision,
          replayed: written.replayed,
        }
      : written
  }
}

function invalidResource() {
  return new CompanyResourceValidationError("invalid_resource")
}

async function fingerprint(parts: ReadonlyArray<string>): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(parts)),
  )
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
