import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { describe, expect, test } from "bun:test"
import { resolveCompanyGovernanceRoleAssignees } from "@/contexts/governance/domain/policies/resolve-company-governance-role-assignees.policy"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

function resource(
  type: "responsibility" | "authority-scope" | "responsibility-assignment",
  id: string,
  attributes: Record<string, string | boolean | null>,
) {
  const restored = CompanyResourceEntity.create({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type,
    id,
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate("2025-01-01"),
    effectiveTo: null,
    attributes,
  })
  if (restored instanceof Error) throw restored
  return restored
}

const responsibility = resource("responsibility", "responsibility:ciso", {
  code: "ciso",
  officialName: "CISO",
})
const scope = resource("authority-scope", "scope:security", {
  scopeType: "organization-unit",
  scopeId: "0190005f-0000-7000-8000-9ce54195b83b",
})

describe("Company governance role assignees", () => {
  test("同じCompany snapshotの責務・部署scope・従業員を任命へ解決する", () => {
    const result = resolveCompanyGovernanceRoleAssignees({
      responsibilityCode: "ciso",
      resources: [
        responsibility,
        scope,
        resource("responsibility-assignment", "assignment:2", {
          responsibilityId: responsibility.id,
          holderType: "employee",
          holderId: "86cf8dfa-151f-424b-ae22-fa25a715308d",
          authorityScopeId: scope.id,
          delegationAllowed: false,
        }),
        resource("responsibility-assignment", "assignment:1", {
          responsibilityId: responsibility.id,
          holderType: "employee",
          holderId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
          authorityScopeId: null,
          delegationAllowed: false,
        }),
      ],
      employees: [
        { id: "86cf8dfa-151f-424b-ae22-fa25a715308d", code: "E002", name: "Second" },
        { id: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1", code: "E001", name: "First" },
      ],
      departments: [{ id: "0190005f-0000-7000-8000-9ce54195b83b", code: "SECURITY" }],
    })

    expect(result).toEqual([
      {
        assignmentId: "assignment:1",
        employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
        employeeCode: "E001",
        employeeName: "First",
        departmentCode: null,
      },
      {
        assignmentId: "assignment:2",
        employeeId: "86cf8dfa-151f-424b-ae22-fa25a715308d",
        employeeCode: "E002",
        employeeName: "Second",
        departmentCode: "SECURITY",
      },
    ])
  })

  test("欠落・重複・未解決参照を候補なしへ変換しない", () => {
    const assignment = resource("responsibility-assignment", "assignment:1", {
      responsibilityId: responsibility.id,
      holderType: "employee",
      holderId: "employee:missing",
      authorityScopeId: null,
      delegationAllowed: false,
    })
    expect(
      resolveCompanyGovernanceRoleAssignees({
        responsibilityCode: "unknown",
        resources: [responsibility],
        employees: [],
        departments: [],
      }),
    ).toBeInstanceOf(Error)
    expect(
      resolveCompanyGovernanceRoleAssignees({
        responsibilityCode: "ciso",
        resources: [responsibility, responsibility],
        employees: [],
        departments: [],
      }),
    ).toBeInstanceOf(Error)
    expect(
      resolveCompanyGovernanceRoleAssignees({
        responsibilityCode: "ciso",
        resources: [responsibility, assignment],
        employees: [],
        departments: [],
      }),
    ).toBeInstanceOf(Error)
  })
})
