import { OrgMembership } from "@/contexts/company-compatibility/domain/organization/org-membership.entity"
import { describe, expect, test } from "bun:test"

describe("OrgMembership", () => {
  test("builds with given fields", () => {
    const membership = new OrgMembership({
      departmentCode: "D001",
      employeeCode: "E001",
      managerEmployeeCode: "E002",
    })

    expect(membership).toBeInstanceOf(OrgMembership)
    expect(membership.departmentCode).toBe("D001")
    expect(membership.employeeCode).toBe("E001")
    expect(membership.managerEmployeeCode).toBe("E002")
  })

  test("updateManager returns new with changed manager", () => {
    const membership = new OrgMembership({
      departmentCode: "D001",
      employeeCode: "E001",
      managerEmployeeCode: null,
    })

    const updated = membership.updateManager("E003")

    expect(updated.managerEmployeeCode).toBe("E003")
    expect(updated.employeeCode).toBe("E001")
  })
})
