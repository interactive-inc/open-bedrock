import { describe, expect, test } from "bun:test"
import { buildDepartmentTree } from "@/domain/org/build-department-tree"
import { OrgDepartment } from "@/domain/org/org-department"

function makeDepartment(code: string, parentCode: string | null, order = 1): OrgDepartment {
  return new OrgDepartment({
    code,
    departmentId: Number.parseInt(code.replace("D", ""), 10),
    parentCode,
    managerEmployeeCode: null,
    order,
  })
}

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

  test("builds a normal tree without cycles", () => {
    const departments = [
      makeDepartment("D001", null),
      makeDepartment("D002", "D001"),
      makeDepartment("D003", "D001", 2),
    ]

    const tree = buildDepartmentTree({
      departments,
      departmentNamesByCode: new Map([
        ["D001", "Root"],
        ["D002", "Child A"],
        ["D003", "Child B"],
      ]),
      memberCountsByCode: new Map(),
    })

    expect(tree.length).toBe(1)
    expect(tree[0]?.children.length).toBe(2)
    expect(tree[0]?.children[0]?.department.code).toBe("D002")
    expect(tree[0]?.children[1]?.department.code).toBe("D003")
  })

  test("does not infinite-loop when two departments form a cycle (A→B→A)", () => {
    const departments = [makeDepartment("D001", "D002"), makeDepartment("D002", "D001")]

    // Both point to each other — no root nodes. Tree should be empty (no crash).
    const tree = buildDepartmentTree({
      departments,
      departmentNamesByCode: new Map(),
      memberCountsByCode: new Map(),
    })

    expect(tree.length).toBe(0)
  })

  test("does not infinite-loop when a child points back to an ancestor (A→B→C→A)", () => {
    const departments = [
      makeDepartment("D001", "D003"),
      makeDepartment("D002", "D001"),
      makeDepartment("D003", "D002"),
    ]

    const tree = buildDepartmentTree({
      departments,
      departmentNamesByCode: new Map(),
      memberCountsByCode: new Map(),
    })

    // All form a cycle with no root — tree should be empty (no crash).
    expect(tree.length).toBe(0)
  })

  test("does not infinite-loop when a self-referencing node exists", () => {
    const departments = [makeDepartment("D001", null), makeDepartment("D002", "D002")]

    const tree = buildDepartmentTree({
      departments,
      departmentNamesByCode: new Map(),
      memberCountsByCode: new Map(),
    })

    // D001 is root, D002 is self-referencing and child of itself (not reachable from root).
    expect(tree.length).toBe(1)
    expect(tree[0]?.department.code).toBe("D001")
  })

  test("handles a partial cycle with a valid subtree", () => {
    const departments = [
      makeDepartment("D001", null),
      makeDepartment("D002", "D001"),
      // D003 and D004 form a cycle separate from the main tree
      makeDepartment("D003", "D004"),
      makeDepartment("D004", "D003"),
    ]

    const tree = buildDepartmentTree({
      departments,
      departmentNamesByCode: new Map(),
      memberCountsByCode: new Map(),
    })

    // Only D001 and D002 should appear; D003/D004 cycle is unreachable from root.
    expect(tree.length).toBe(1)
    expect(tree[0]?.children.length).toBe(1)
    expect(tree[0]?.children[0]?.department.code).toBe("D002")
  })
})
