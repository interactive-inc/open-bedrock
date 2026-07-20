import { listReportEmployeeIds } from "@/lib/org/list-report-employee-ids"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
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

function toSorted(ids: Array<number> | Error): Array<number> {
  if (ids instanceof Error) throw ids

  return [...ids].sort((a, b) => a - b)
}

describe("listReportEmployeeIds", () => {
  test("direct reports: E004 has E005 and E006", async () => {
    const ids = await listReportEmployeeIds({
      c: await makeContext(),
      viewerEmployeeId: 4,
    })

    expect(toSorted(ids)).toEqual([5, 6])
  })

  test("recursive reports: E001 covers the whole tree below", async () => {
    const ids = await listReportEmployeeIds({
      c: await makeContext(),
      viewerEmployeeId: 1,
    })

    expect(toSorted(ids)).toEqual([2, 3, 4, 5, 6])
  })

  test("no reports: E005 is a leaf", async () => {
    const ids = await listReportEmployeeIds({
      c: await makeContext(),
      viewerEmployeeId: 5,
    })

    expect(toSorted(ids)).toEqual([])
  })

  test("does not include the viewer itself", async () => {
    const ids = await listReportEmployeeIds({
      c: await makeContext(),
      viewerEmployeeId: 1,
    })

    if (ids instanceof Error) throw ids

    expect(ids.includes(1)).toBe(false)
  })

  test("cycle terminates without runaway: E007 and E008 do not list each other endlessly", async () => {
    const ids = await listReportEmployeeIds({
      c: await makeContext(),
      viewerEmployeeId: 7,
    })

    expect(toSorted(ids)).toEqual([8])
  })

  test("membership-less viewer has no reports", async () => {
    const ids = await listReportEmployeeIds({
      c: await makeContext(),
      viewerEmployeeId: 99,
    })

    expect(toSorted(ids)).toEqual([])
  })
})
