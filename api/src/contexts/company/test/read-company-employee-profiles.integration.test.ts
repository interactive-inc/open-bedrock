import { readCompanyEmployeeProfiles } from "@/contexts/company/interface/operations/read-company-employee-profiles"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { expect, test } from "bun:test"

test("表示用の氏名と従業員 code を、接続済みは公開 resource、未接続は表から読む", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.assignEmployeeCode(f.creator.employeeId, "EMPLOYEE-001")
  await f.database
    .prepare(
      `INSERT INTO company_employees (id, official_name, employee_code, email, phone, created_at, updated_at)
       VALUES ('31cf526f-0921-48a3-be38-c1458aaf2671', 'Unconnected Person', 'LEGACY-9', NULL, NULL, 0, 0)`,
    )
    .run()

  const profiles = await readCompanyEmployeeProfiles({
    database: f.database,
    employeeIds: [f.creator.employeeId, "31cf526f-0921-48a3-be38-c1458aaf2671", "employee:missing"],
    asOf: "2030-06-01" as never,
  })
  if (profiles instanceof Error) throw profiles

  expect(profiles.get(f.creator.employeeId)).toMatchObject({
    employeeCode: "EMPLOYEE-001",
    officialName: expect.stringMatching(/\S/),
  })
  expect(profiles.get("31cf526f-0921-48a3-be38-c1458aaf2671" as never)).toEqual({
    officialName: "Unconnected Person",
    employeeCode: "LEGACY-9",
  })
  expect(profiles.has("employee:missing" as never)).toBe(false)
})
