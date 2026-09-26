import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyGovernanceRoleAssignmentReadAdapter } from "@/contexts/governance/infrastructure/adapters/company-governance-role-assignment-read.adapter"
import { expect, test } from "bun:test"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

function resource(
  type: CompanyResourceEntity["type"],
  id: string,
  attributes: Record<string, string | boolean | null>,
) {
  const result = CompanyResourceEntity.create({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type,
    id,
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate("2025-01-01"),
    effectiveTo: null,
    attributes,
  })
  if (result instanceof Error) throw result
  return result
}

test("Companyの指定版だけから責務任命と人物名を解決する", async () => {
  const queries: unknown[] = []
  const responsibility = resource("responsibility", "responsibility:ciso", {
    code: "ciso",
    officialName: "CISO",
  })
  const result = await new CompanyGovernanceRoleAssignmentReadAdapter({
    repository: {
      findMany: async (query) => {
        queries.push(query)
        return {
          ok: true as const,
          organizationRevision: 7,
          resources: [
            resource("person", "person:1", { officialName: "First" }),
            resource("employee", "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1", {
              personId: "person:1",
              employeeCode: "E001",
            }),
            responsibility,
            resource("responsibility-assignment", "assignment:1", {
              responsibilityId: responsibility.id,
              holderType: "employee",
              holderId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
              authorityScopeId: null,
              delegationAllowed: false,
            }),
          ],
        }
      },
    },
  }).read({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    responsibilityCode: "ciso",
    effectiveOn: restoreCalendarDate("2026-01-01"),
    organizationRevision: 7,
  })

  expect(result).toEqual({
    organizationRevision: 7,
    assignees: [
      {
        assignmentId: "assignment:1",
        employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
        employeeCode: "E001",
        employeeName: "First",
        departmentCode: null,
      },
    ],
  })
  expect(queries).toEqual([
    expect.objectContaining({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      organizationRevision: 7,
      effectiveOn: "2026-01-01",
    }),
  ])
})

test("Companyの欠落・破損を空の任命一覧として返さない", async () => {
  const result = await new CompanyGovernanceRoleAssignmentReadAdapter({
    repository: {
      findMany: async () => ({ ok: true as const, organizationRevision: 1, resources: [] }),
    },
  }).read({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    responsibilityCode: "ciso",
    effectiveOn: restoreCalendarDate("2026-01-01"),
  })

  expect(result).toBeInstanceOf(Error)
})
