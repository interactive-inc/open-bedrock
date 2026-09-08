import { expect } from "bun:test"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"

export async function createCompanyAuthorityEmploymentTestContext(
  type: "office-assignment" | "organizational-authority",
) {
  const f = await createCompanyAssignmentResourceTestContext()
  const assignment = await f.initializeAssignment()
  const common = {
    organizationId: "organization:default",
    revision: 1,
    state: "active" as const,
    effectiveFrom: restoreCalendarDate("2030-03-01"),
    effectiveTo: null,
  }
  const attributes = {
    employeeId: assignment.attributes.employeeId,
    employmentId: assignment.attributes.employmentId,
  }
  const change = CompanyResourceChangeEntity.create({
    commandId: `authority:${type}`,
    expectedRevision: await f.companyRevision(),
    actorAccountId: f.creator.accountId,
    reason: "Confirm authority appointment",
    recordedAt: f.at.getTime(),
    resources: [
      {
        ...common,
        type: "position",
        id: "position:authority-test",
        attributes: { code: "TEAM_LEAD", officialName: "Team Lead" },
      },
      {
        ...common,
        type: "organizational-office",
        id: "office:authority-test",
        attributes: {
          code: "TEAM_LEAD",
          officialName: "Team Lead",
          organizationUnitId: "unit:journal",
          positionId: "position:authority-test",
        },
      },
      type === "office-assignment"
        ? {
            ...common,
            type,
            id: "appointment:authority-test",
            attributes: { ...attributes, organizationalOfficeId: "office:authority-test" },
          }
        : {
            ...common,
            type,
            id: "appointment:authority-test",
            attributes: {
              ...attributes,
              scopeType: "organization-unit",
              scopeId: "unit:journal",
              authority: "WORK_REVIEW",
            },
          },
    ],
  })
  if (change instanceof Error) throw change
  const written = await new D1CompanyResourceRepository(f.database).write(change)
  expect(written).toMatchObject({ kind: "applied" })
  const appointment = change.resources.find((resource) => resource.type === type)
  if (appointment === undefined) throw new Error("appointment missing")
  return { ...f, assignment, appointment }
}
