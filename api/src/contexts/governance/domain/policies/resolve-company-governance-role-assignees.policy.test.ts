import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { describe, expect, test } from "bun:test"
import { resolveCompanyGovernanceRoleAssignees } from "@/contexts/governance/domain/policies/resolve-company-governance-role-assignees.policy"

function resource(
  type: "responsibility" | "authority-scope" | "responsibility-assignment",
  id: string,
  attributes: Record<string, string | boolean | null>,
) {
  const restored = CompanyResourceEntity.create({
    organizationId: "organization:default",
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
  scopeId: "department:security",
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
          holderId: "employee:2",
          authorityScopeId: scope.id,
          delegationAllowed: false,
        }),
        resource("responsibility-assignment", "assignment:1", {
          responsibilityId: responsibility.id,
          holderType: "employee",
          holderId: "employee:1",
          authorityScopeId: null,
          delegationAllowed: false,
        }),
      ],
      employees: [
        { id: "employee:2", code: "E002", name: "Second" },
        { id: "employee:1", code: "E001", name: "First" },
      ],
      departments: [{ id: "department:security", code: "SECURITY" }],
    })

    expect(result).toEqual([
      {
        assignmentId: "assignment:1",
        employeeId: "employee:1",
        employeeCode: "E001",
        employeeName: "First",
        departmentCode: null,
      },
      {
        assignmentId: "assignment:2",
        employeeId: "employee:2",
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
