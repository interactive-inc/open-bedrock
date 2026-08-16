import { resolveEmployeeRelation } from "@/contexts/company/application/organization/resolve-employee-relation"
import { createTestContext } from "@/api/test/support/create-test-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { describe, expect, test } from "bun:test"
import type { Context } from "@/env"

/**
 * E001(top) < E004 < E005, E006  /  E001 < E002 < E003
 * E007/E008 は循環(相互参照)。E099 は membership なし。
 */
const employeeRows = [
  { id: 1, code: "E001", name: "Top", status: "active" },
  { id: 2, code: "E002", name: "HeadHr", status: "active" },
  { id: 3, code: "E003", name: "HrStaff", status: "active" },
  { id: 4, code: "E004", name: "EngMgr", status: "active" },
  { id: 5, code: "E005", name: "Eng", status: "active" },
  { id: 6, code: "E006", name: "Eng2", status: "active" },
  { id: 7, code: "E007", name: "CycleA", status: "active" },
  { id: 8, code: "E008", name: "CycleB", status: "active" },
  { id: 99, code: "E099", name: "NoMember", status: "active" },
]

const membershipRows = [
  { department_code: "D001", employee_code: "E001", manager_employee_code: null },
  { department_code: "D002", employee_code: "E002", manager_employee_code: "E001" },
  { department_code: "D002", employee_code: "E003", manager_employee_code: "E002" },
  { department_code: "D003", employee_code: "E004", manager_employee_code: "E001" },
  { department_code: "D003", employee_code: "E005", manager_employee_code: "E004" },
  { department_code: "D003", employee_code: "E006", manager_employee_code: "E004" },
  { department_code: "D004", employee_code: "E007", manager_employee_code: "E008" },
  { department_code: "D004", employee_code: "E008", manager_employee_code: "E007" },
]

async function makeContext(): Promise<Context> {
  const { context, db } = createTestContext()

  await seedD1(db, "employees", employeeRows)

  await seedD1(db, "org_memberships", membershipRows)

  return context
}

describe("resolveEmployeeRelation", () => {
  test("self: viewer equals target", async () => {
    const relation = await resolveEmployeeRelation({
      c: await makeContext(),
      viewerEmployeeId: 5,
      targetEmployeeId: 5,
    })

    expect(relation).toEqual({ isSelf: true, isReport: false, isSameDepartment: false })
  })

  test("direct report: E004 manages E005", async () => {
    const relation = await resolveEmployeeRelation({
      c: await makeContext(),
      viewerEmployeeId: 4,
      targetEmployeeId: 5,
    })

    if (relation instanceof Error) throw relation

    expect(relation.isReport).toBe(true)
    expect(relation.isSameDepartment).toBe(true)
  })

  test("grand-report: E001 is above E005 through E004", async () => {
    const relation = await resolveEmployeeRelation({
      c: await makeContext(),
      viewerEmployeeId: 1,
      targetEmployeeId: 5,
    })

    if (relation instanceof Error) throw relation

    expect(relation.isReport).toBe(true)
    expect(relation.isSameDepartment).toBe(false)
  })

  test("unrelated: E002 is not above E005", async () => {
    const relation = await resolveEmployeeRelation({
      c: await makeContext(),
      viewerEmployeeId: 2,
      targetEmployeeId: 5,
    })

    if (relation instanceof Error) throw relation

    expect(relation.isReport).toBe(false)
    expect(relation.isSameDepartment).toBe(false)
  })

  test("same department, not a report: E005 and E006 under E004", async () => {
    const relation = await resolveEmployeeRelation({
      c: await makeContext(),
      viewerEmployeeId: 5,
      targetEmployeeId: 6,
    })

    if (relation instanceof Error) throw relation

    expect(relation.isReport).toBe(false)
    expect(relation.isSameDepartment).toBe(true)
  })

  test("cycle: mutual manager references terminate without matching", async () => {
    const relation = await resolveEmployeeRelation({
      c: await makeContext(),
      viewerEmployeeId: 1,
      targetEmployeeId: 7,
    })

    if (relation instanceof Error) throw relation

    expect(relation.isReport).toBe(false)
  })

  test("membership-less target: same department is false", async () => {
    const relation = await resolveEmployeeRelation({
      c: await makeContext(),
      viewerEmployeeId: 1,
      targetEmployeeId: 99,
    })

    if (relation instanceof Error) throw relation

    expect(relation.isReport).toBe(false)
    expect(relation.isSameDepartment).toBe(false)
  })
})
