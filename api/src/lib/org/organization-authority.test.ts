import { describe, expect, test } from "bun:test"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import {
  listManagedEmployeeIds,
  resolveOrganizationAuthority,
} from "@/lib/org/organization-authority"

async function setup() {
  const { context, db } = createTestContext()

  await seedD1(db, "employees", [
    { id: 1, code: "E001", name: "Director", status: "active" },
    { id: 2, code: "E002", name: "Manager", status: "active" },
    { id: 3, code: "E003", name: "Member", status: "active" },
    { id: 4, code: "E004", name: "Other", status: "active" },
  ])

  await seedD1(db, "org_departments", [
    { code: "ROOT", department_id: 1, manager_employee_code: "E001", sort_order: 1 },
    {
      code: "TEAM",
      department_id: 2,
      parent_code: "ROOT",
      manager_employee_code: "E002",
      sort_order: 2,
    },
  ])

  await seedD1(db, "org_memberships", [
    { department_code: "ROOT", employee_code: "E001" },
    { department_code: "TEAM", employee_code: "E002", manager_employee_code: "E001" },
    { department_code: "TEAM", employee_code: "E003", manager_employee_code: "E002" },
    { department_code: "ROOT", employee_code: "E004", manager_employee_code: "E001" },
  ])

  return context
}

describe("organization authority", () => {
  test("resolves direct, department and ancestor relationships", async () => {
    const context = await setup()

    expect(await resolveOrganizationAuthority(context, 2, 3)).toEqual({
      directManager: true,
      departmentManager: true,
      managementChain: true,
    })

    expect(await resolveOrganizationAuthority(context, 1, 3)).toEqual({
      directManager: false,
      departmentManager: false,
      managementChain: true,
    })
  })

  test("does not grant authority to unrelated employees or self", async () => {
    const context = await setup()

    expect(await resolveOrganizationAuthority(context, 4, 3)).toEqual({
      directManager: false,
      departmentManager: false,
      managementChain: false,
    })

    expect(await resolveOrganizationAuthority(context, 3, 3)).toEqual({
      directManager: false,
      departmentManager: false,
      managementChain: false,
    })
  })

  test("lists direct, indirect and department-managed employees", async () => {
    const context = await setup()

    expect(await listManagedEmployeeIds(context, 1)).toEqual([2, 3, 4])
    expect(await listManagedEmployeeIds(context, 2)).toEqual([3])
    expect(await listManagedEmployeeIds(context, 3)).toEqual([])
  })
})
