import { DeleteEmployee } from "@/application/employee/delete-employee"
import { GetEmployee } from "@/application/employee/get-employee"
import { RegisterEmployee } from "@/application/employee/register-employee"
import { UpdateEmployee } from "@/application/employee/update-employee"
import { Employee } from "@/domain/employee/employee"
import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

async function seedEmployee(context: Context, code: string): Promise<number> {
  const repository = new EmployeeRepository(context)

  const created = await repository.create({
    code: code,
    name: "Sam Rivers",
    email: `you+${code.toLowerCase()}@example.com`,
    passwordHash: "hash",
    role: "member",
    deptId: 3,
    deptName: "Engineering",
    position: "Engineer",
    status: "active",
  })

  if (created instanceof Error) {
    throw new Error("seed failed")
  }

  return created.id
}

const newEmployeeInput = {
  code: "E900",
  name: "Sam Rivers",
  email: "you+e900@example.com",
  password: "initial-password",
  role: "member",
  deptId: 3,
  deptName: "Engineering",
  position: "Engineer",
  status: "active" as const,
}

describe("RegisterEmployee", () => {
  test("registers an employee for a privileged role", async () => {
    const context = createTestContext().context

    const result = await new RegisterEmployee(context).run({
      viewerRole: "admin",
      employee: newEmployeeInput,
    })

    expect(result).toBeInstanceOf(Employee)

    if (result instanceof Error || "reason" in result) {
      throw new Error("register failed")
    }

    expect(result.code).toBe("E900")
    expect(result.deptName).toBe("Engineering")
  })

  test("rejects a non privileged role with forbidden", async () => {
    const context = createTestContext().context

    const result = await new RegisterEmployee(context).run({
      viewerRole: "member",
      employee: newEmployeeInput,
    })

    expect(result).toEqual({ reason: "forbidden" })
  })

  test("rejects a duplicate code with employee_code_conflict", async () => {
    const context = createTestContext().context

    await seedEmployee(context, "E900")

    const result = await new RegisterEmployee(context).run({
      viewerRole: "admin",
      employee: newEmployeeInput,
    })

    expect(result).toEqual({ reason: "employee_code_conflict" })
  })

  test("rejects a password shorter than 8 characters with weak_password", async () => {
    const context = createTestContext().context

    const result = await new RegisterEmployee(context).run({
      viewerRole: "admin",
      employee: { ...newEmployeeInput, password: "short7!" },
    })

    expect(result).toEqual({ reason: "weak_password" })
  })
})

describe("GetEmployee", () => {
  test("returns the employee by code", async () => {
    const context = createTestContext().context

    await seedEmployee(context, "E901")

    const result = await new GetEmployee(context).run({ code: "E901" })

    expect(result).toBeInstanceOf(Employee)
  })

  test("returns employee_not_found for an unknown code", async () => {
    const context = createTestContext().context

    const result = await new GetEmployee(context).run({ code: "E999" })

    expect(result).toEqual({ reason: "employee_not_found" })
  })
})

const profileInput = {
  name: "Renamed",
  email: "you+renamed@example.com",
  role: "manager",
  deptId: 4,
  deptName: "Sales",
  position: "Lead",
  status: "leave" as const,
}

describe("UpdateEmployee", () => {
  test("updates the profile for a privileged role", async () => {
    const context = createTestContext().context

    await seedEmployee(context, "E902")

    const result = await new UpdateEmployee(context).run({
      viewerRole: "admin",
      code: "E902",
      profile: profileInput,
    })

    expect(result).toBeInstanceOf(Employee)

    if (result instanceof Error || "reason" in result) {
      throw new Error("update failed")
    }

    expect(result.name).toBe("Renamed")
    expect(result.role).toBe("manager")
    expect(result.status).toBe("leave")
  })

  test("rejects a non privileged role with forbidden", async () => {
    const context = createTestContext().context

    await seedEmployee(context, "E903")

    const result = await new UpdateEmployee(context).run({
      viewerRole: "member",
      code: "E903",
      profile: profileInput,
    })

    expect(result).toEqual({ reason: "forbidden" })
  })

  test("rejects an unknown code with employee_not_found", async () => {
    const context = createTestContext().context

    const result = await new UpdateEmployee(context).run({
      viewerRole: "admin",
      code: "E999",
      profile: profileInput,
    })

    expect(result).toEqual({ reason: "employee_not_found" })
  })
})

describe("DeleteEmployee", () => {
  test("deletes an employee for a privileged role", async () => {
    const context = createTestContext().context

    const id = await seedEmployee(context, "E904")

    const result = await new DeleteEmployee(context).run({
      viewerRole: "admin",
      viewerEmployeeId: id + 1,
      code: "E904",
    })

    expect(result).toEqual({ reason: "deleted" })

    const found = await new EmployeeRepository(context).findByCode("E904")

    expect(found).toBeNull()
  })

  test("rejects deleting your own account with self_delete", async () => {
    const context = createTestContext().context

    const id = await seedEmployee(context, "E905")

    const result = await new DeleteEmployee(context).run({
      viewerRole: "admin",
      viewerEmployeeId: id,
      code: "E905",
    })

    expect(result).toEqual({ reason: "self_delete" })
  })

  test("rejects a non privileged role with forbidden", async () => {
    const context = createTestContext().context

    const id = await seedEmployee(context, "E906")

    const result = await new DeleteEmployee(context).run({
      viewerRole: "member",
      viewerEmployeeId: id + 1,
      code: "E906",
    })

    expect(result).toEqual({ reason: "forbidden" })
  })

  test("rejects an unknown code with employee_not_found", async () => {
    const context = createTestContext().context

    const result = await new DeleteEmployee(context).run({
      viewerRole: "admin",
      viewerEmployeeId: 1,
      code: "E999",
    })

    expect(result).toEqual({ reason: "employee_not_found" })
  })
})
