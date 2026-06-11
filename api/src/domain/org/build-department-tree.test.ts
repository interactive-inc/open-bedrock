import { buildDepartmentTree } from "@/domain/org/build-department-tree"
import { OrgDepartment } from "@/domain/org/org-department"
import { describe, expect, test } from "bun:test"

describe("buildDepartmentTree", () => {
  test("empty departments returns empty array", () => {
    const tree = buildDepartmentTree({
      departments: [],
      departmentNamesByCode: new Map(),
      memberCountsByCode: new Map(),
    })

    expect(tree.length).toBe(0)
  })

  test("single root department builds single node", () => {
    const dept = OrgDepartment.create({
      code: "D001",
      departmentId: 1,
      parentCode: null,
      managerEmployeeCode: null,
      order: 0,
    })

    const tree = buildDepartmentTree({
      departments: [dept],
      departmentNamesByCode: new Map([["D001", "Engineering"]]),
      memberCountsByCode: new Map([["D001", 10]]),
    })

    expect(tree.length).toBe(1)
    expect(tree[0].name).toBe("Engineering")
    expect(tree[0].memberCount).toBe(10)
    expect(tree[0].children.length).toBe(0)
  })

  test("parent-child relationship builds tree with children", () => {
    const parent = OrgDepartment.create({
      code: "D001",
      departmentId: 1,
      parentCode: null,
      managerEmployeeCode: null,
      order: 0,
    })

    const child = OrgDepartment.create({
      code: "D002",
      departmentId: 2,
      parentCode: "D001",
      managerEmployeeCode: null,
      order: 0,
    })

    const tree = buildDepartmentTree({
      departments: [parent, child],
      departmentNamesByCode: new Map([
        ["D001", "Engineering"],
        ["D002", "Frontend"],
      ]),
      memberCountsByCode: new Map(),
    })

    expect(tree.length).toBe(1)
    expect(tree[0].children.length).toBe(1)
    expect(tree[0].children[0].name).toBe("Frontend")
  })

  test("siblings are sorted by order", () => {
    const parent = OrgDepartment.create({
      code: "D001",
      departmentId: 1,
      parentCode: null,
      managerEmployeeCode: null,
      order: 0,
    })

    const childB = OrgDepartment.create({
      code: "D003",
      departmentId: 3,
      parentCode: "D001",
      managerEmployeeCode: null,
      order: 2,
    })

    const childA = OrgDepartment.create({
      code: "D002",
      departmentId: 2,
      parentCode: "D001",
      managerEmployeeCode: null,
      order: 1,
    })

    const tree = buildDepartmentTree({
      departments: [parent, childB, childA],
      departmentNamesByCode: new Map([
        ["D001", "Engineering"],
        ["D002", "Frontend"],
        ["D003", "Backend"],
      ]),
      memberCountsByCode: new Map(),
    })

    expect(tree[0].children[0].name).toBe("Frontend")
    expect(tree[0].children[1].name).toBe("Backend")
  })
})
