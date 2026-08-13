import { describe, expect, test } from "bun:test"
import { OrgDepartment } from "@/contexts/company/domain/organization/org-department.entity"
import { OrgDepartmentRepository } from "@/contexts/company/infrastructure/organization/org-department-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"

function makeDepartment(code: string, parentCode: string | null): OrgDepartment {
  return OrgDepartment.create({
    code,
    departmentId: 1,
    parentCode,
    managerEmployeeCode: null,
    order: 1,
  })
}

describe("OrgDepartmentRepository.create", () => {
  test("creates a root department without a parent", async () => {
    const { context } = createTestContext()

    const repository = new OrgDepartmentRepository(context)

    const created = await repository.create(makeDepartment("D801", null))

    if (created instanceof OrgDepartment === false) {
      throw new Error("expected created department")
    }

    expect(created.code).toBe("D801")
  })

  test("creates a child atomically when the parent exists", async () => {
    const { context } = createTestContext()

    const repository = new OrgDepartmentRepository(context)

    await repository.create(makeDepartment("D801", null))

    const created = await repository.create(makeDepartment("D802", "D801"))

    if (created instanceof OrgDepartment === false) {
      throw new Error("expected created department")
    }

    expect(created.parentCode).toBe("D801")
  })

  test("returns parent_not_found when the parent does not exist (no orphan row)", async () => {
    const { context } = createTestContext()

    const repository = new OrgDepartmentRepository(context)

    const created = await repository.create(makeDepartment("D803", "D999"))

    expect(created).toEqual({ reason: "parent_not_found" })

    const orphan = await repository.findByCode("D803")

    expect(orphan).toBeNull()
  })
})
