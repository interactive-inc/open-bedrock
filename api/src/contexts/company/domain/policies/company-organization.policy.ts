import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { OrganizationStructureValue } from "@/contexts/company/domain/values/organization-structure.value"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/values/restore-calendar-date.definition"
import type { OrganizationRelation } from "@/contexts/company/domain/values/organization-relation.definition"
import { orgAssignmentTypes } from "@/contexts/company/domain/values/org-assignment-type.definition"

function hasContainingOrganizationUnit(
  resource: CompanyResourceEntity,
  organizationUnitId: string,
  activeUnits: ReadonlyArray<CompanyResourceEntity>,
): boolean {
  return activeUnits.some(
    (unit) =>
      unit.readText("organizationUnitId") === organizationUnitId && unit.containsPeriod(resource),
  )
}

function relationsHaveManagementCycle(
  relations: ReadonlyArray<OrganizationRelation>,
  date: string,
): boolean {
  const managerByEmployee = new Map<string, string>()
  for (const relation of relations) {
    if (relation.startsOn <= date && (relation.endsOn === null || date < relation.endsOn)) {
      managerByEmployee.set(relation.employeeId, relation.managerEmployeeId)
    }
  }
  for (const employeeId of managerByEmployee.keys()) {
    const visited = new Set<string>()
    let current: string | undefined = employeeId
    while (current !== undefined) {
      if (visited.has(current)) return true
      visited.add(current)
      current = managerByEmployee.get(current)
    }
  }
  return false
}

/** Generic Company resourcesの変更後全体を、組織・配属・指揮命令・権限の横断規則で検証する。 */
export function validateCompanyOrganizationChange(
  currentResources: ReadonlyArray<CompanyResourceEntity>,
  change: CompanyResourceChangeEntity,
): CompanyResourceValidationError | null {
  const merged = new Map(
    currentResources.map((resource) => [`${resource.type}\u0000${resource.id}`, resource]),
  )
  for (const resource of change.resources) {
    merged.set(`${resource.type}\u0000${resource.id}`, resource)
  }
  const resources = [...merged.values()]
  const organizationUnitResources = resources.filter(
    (resource) => resource.type === "organization-unit",
  )
  const units = organizationUnitResources.map((resource) => resource.toOrganizationUnitPeriod())
  if (units.some((unit) => unit === null)) {
    return new CompanyResourceValidationError("invalid_organization")
  }
  const structure = OrganizationStructureValue.restore({
    revision: change.expectedRevision + 1,
    asOf: restoreCalendarDate("1970-01-01"),
    units: units.filter((unit) => unit !== null),
  })
  if (!(structure instanceof OrganizationStructureValue)) {
    return new CompanyResourceValidationError("invalid_organization")
  }

  const activeUnits = organizationUnitResources.filter((resource) => resource.state === "active")
  const assignments = resources.filter(
    (resource) => resource.type === "assignment" && resource.state === "active",
  )
  for (const assignment of assignments) {
    const employeeId = assignment.readText("employeeId")
    const employmentId = assignment.readText("employmentId")
    const organizationUnitId = assignment.readText("organizationUnitId")
    const assignmentType = assignment.readText("assignmentType")
    if (
      employeeId === null ||
      employmentId === null ||
      organizationUnitId === null ||
      assignmentType === null ||
      !orgAssignmentTypes.includes(assignmentType as (typeof orgAssignmentTypes)[number]) ||
      !hasContainingOrganizationUnit(assignment, organizationUnitId, activeUnits)
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
    if (
      assignmentType === "PRIMARY" &&
      assignments.some(
        (candidate) =>
          candidate.id !== assignment.id &&
          candidate.readText("employeeId") === employeeId &&
          candidate.readText("assignmentType") === "PRIMARY" &&
          candidate.overlaps(assignment),
      )
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
  }

  const relations: OrganizationRelation[] = []
  for (const relation of resources.filter(
    (resource) => resource.type === "reporting-relation" && resource.state === "active",
  )) {
    const employeeId = relation.readText("employeeId")
    const managerEmployeeId = relation.readText("managerEmployeeId")
    const organizationUnitId = relation.readText("organizationUnitId")
    if (
      employeeId === null ||
      managerEmployeeId === null ||
      organizationUnitId === null ||
      employeeId === managerEmployeeId ||
      !hasContainingOrganizationUnit(relation, organizationUnitId, activeUnits)
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
    relations.push({
      employeeId,
      managerEmployeeId,
      organizationUnitId,
      startsOn: relation.effectiveFrom,
      endsOn: relation.effectiveTo,
    })
  }
  const boundaries = [
    ...new Set(
      relations.flatMap((relation) => [
        relation.startsOn,
        ...(relation.endsOn === null ? [] : [relation.endsOn]),
      ]),
    ),
  ]
  if (boundaries.some((date) => relationsHaveManagementCycle(relations, date))) {
    return new CompanyResourceValidationError("invalid_organization")
  }

  for (const authority of resources.filter(
    (resource) => resource.type === "organizational-authority" && resource.state === "active",
  )) {
    const employeeId = authority.readText("employeeId")
    const employmentId = authority.readText("employmentId")
    const scopeType = authority.readText("scopeType")
    const scopeId = authority.readText("scopeId")
    const authorityType = authority.readText("authority")
    if (
      employeeId === null ||
      employmentId === null ||
      scopeType !== "organization-unit" ||
      scopeId === null ||
      authorityType === null ||
      !hasContainingOrganizationUnit(authority, scopeId, activeUnits) ||
      !assignments.some(
        (assignment) =>
          assignment.readText("employeeId") === employeeId &&
          assignment.readText("employmentId") === employmentId &&
          assignment.readText("organizationUnitId") === scopeId &&
          assignment.containsPeriod(authority),
      )
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
  }

  return null
}
