import { createTestContext } from "@/api/test/support/create-test-context"
import { ReadEmployeeDirectory } from "@/contexts/company/application/workforce/read-employee-directory"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/workforce-id"
import { EmployeeDirectoryReadRepository } from "@/contexts/company/infrastructure/workforce/employee-directory-read.repository"
import { describe, expect, test } from "bun:test"

describe("EmployeeDirectoryReadRepository", () => {
  test("maps requested profiles and lets the common use case restore requested order", async () => {
    const testContext = createTestContext()
    await testContext.db.exec(`
      INSERT INTO employees (id, code, name, status, phone) VALUES
        (61, 'E061', 'First Person', 'retired', NULL),
        (62, NULL, 'Second Person', 'active', '+81-90-0000-0000')
    `)
    const resolution = await new ReadEmployeeDirectory({
      port: new EmployeeDirectoryReadRepository({ context: testContext.context }),
    }).execute([toWorkforceEmployeeId(62), toWorkforceEmployeeId(63), toWorkforceEmployeeId(61)])

    expect(resolution).toEqual({
      kind: "found",
      employees: [
        {
          id: toWorkforceEmployeeId(62),
          officialName: "Second Person",
          employeeCode: null,
          email: null,
          phone: "+81-90-0000-0000",
        },
        {
          id: toWorkforceEmployeeId(61),
          officialName: "First Person",
          employeeCode: "E061",
          email: null,
          phone: null,
        },
      ],
      missingEmployeeIds: [toWorkforceEmployeeId(63)],
    })
  })

  test("treats a foreign Employee ID namespace as missing", async () => {
    const testContext = createTestContext()

    expect(
      await new ReadEmployeeDirectory({
        port: new EmployeeDirectoryReadRepository({ context: testContext.context }),
      }).execute([restoreWorkforceId("employee", "legacy-employee:61")]),
    ).toEqual({
      kind: "found",
      employees: [],
      missingEmployeeIds: [restoreWorkforceId("employee", "legacy-employee:61")],
    })
  })

  test("fails closed when the Employee table cannot be read", async () => {
    const testContext = createTestContext()
    await testContext.db.exec("DROP TABLE employees")
    const resolution = await new ReadEmployeeDirectory({
      port: new EmployeeDirectoryReadRepository({ context: testContext.context }),
    }).execute([toWorkforceEmployeeId(61)])

    expect(resolution.kind).toBe("unavailable")
  })
})
