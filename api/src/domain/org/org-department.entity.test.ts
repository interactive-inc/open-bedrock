import { OrgDepartment } from "@/domain/org/org-department.entity"
import { describe, expect, test } from "bun:test"

describe("OrgDepartment.create", () => {
  test("builds with given fields", () => {
    const dept = OrgDepartment.create({
      code: "D001",
      departmentId: 1,
      parentCode: null,
      managerEmployeeCode: "E001",
      order: 0,
    })

    expect(dept).toBeInstanceOf(OrgDepartment)
    expect(dept.code).toBe("D001")
    expect(dept.parentCode).toBe(null)
  })
})

describe("OrgDepartment.updateOrder", () => {
  test("returns new with changed order", () => {
    const dept = OrgDepartment.create({
      code: "D001",
      departmentId: 1,
      parentCode: null,
      managerEmployeeCode: null,
      order: 0,
    })

    const updated = dept.updateOrder(5)

    expect(updated.order).toBe(5)
    expect(updated.code).toBe("D001")
  })
})

describe("OrgDepartment.updateManager", () => {
  test("returns new with changed manager", () => {
    const dept = OrgDepartment.create({
      code: "D001",
      departmentId: 1,
      parentCode: null,
      managerEmployeeCode: null,
      order: 0,
    })

    const updated = dept.updateManager("E002")

    expect(updated.managerEmployeeCode).toBe("E002")
  })
})

describe("OrgDepartment.withParent", () => {
  test("returns new with changed parent", () => {
    const dept = OrgDepartment.create({
      code: "D002",
      departmentId: 2,
      parentCode: null,
      managerEmployeeCode: null,
      order: 0,
    })

    const updated = dept.withParent("D001")

    expect(updated.parentCode).toBe("D001")
  })
})
