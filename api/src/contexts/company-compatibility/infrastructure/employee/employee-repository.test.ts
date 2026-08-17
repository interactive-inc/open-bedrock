import { Employee } from "@/contexts/company-compatibility/domain/employee/employee.entity"
import { EmployeeRepository } from "@/contexts/company-compatibility/infrastructure/employee/employee-repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { describe, expect, test } from "bun:test"

describe("EmployeeRepository", () => {
  test("findByCode returns the seeded employee", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "employees", [
      {
        id: 1,
        code: "E001",
        name: "テスト社員",
        dept_id: null,
        dept_name: null,
        position: null,
        status: "active",
      },
    ])

    const repository = new EmployeeRepository(context)

    const found = await repository.findByCode("E001")

    expect(found).toBeInstanceOf(Employee)

    if (found instanceof Error || found === null) {
      throw new Error("findByCode failed")
    }

    expect(found.code).toBe("E001")
  })

  test("findByCode returns null when not seeded", async () => {
    const { context } = createTestContext()

    const repository = new EmployeeRepository(context)

    const found = await repository.findByCode("UNKNOWN")

    expect(found).toBeNull()
  })
})
