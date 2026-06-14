import { Employee } from "@/domain/employee/employee.entity"
import { describe, expect, test } from "bun:test"

describe("Employee.fromRow", () => {
  test("builds an Employee from a row with active status", () => {
    const employee = Employee.fromRow({
      id: 1,
      code: "E001",
      name: "Taro Yamada",
      email: "taro@example.com",
      passwordHash: "hashed",
      role: "member",
      deptId: 10,
      deptName: "Engineering",
      position: "Staff",
      status: "active",
    })

    expect(employee).toBeInstanceOf(Employee)
    expect(employee.id).toBe(1)
    expect(employee.code).toBe("E001")
    expect(employee.name).toBe("Taro Yamada")
    expect(employee.email).toBe("taro@example.com")
    expect(employee.role).toBe("member")
    expect(employee.deptId).toBe(10)
    expect(employee.deptName).toBe("Engineering")
    expect(employee.position).toBe("Staff")
    expect(employee.status).toBe("active")
  })

  test("builds an Employee with leave status", () => {
    const employee = Employee.fromRow({
      id: 2,
      code: "E002",
      name: "Hanako Suzuki",
      email: "hanako@example.com",
      passwordHash: "hashed",
      role: "hr",
      deptId: null,
      deptName: null,
      position: null,
      status: "leave",
    })

    expect(employee.status).toBe("leave")
    expect(employee.deptId).toBeNull()
    expect(employee.deptName).toBeNull()
    expect(employee.position).toBeNull()
  })

  test("builds an Employee with retired status", () => {
    const employee = Employee.fromRow({
      id: 3,
      code: "E003",
      name: "Jiro Tanaka",
      email: "jiro@example.com",
      passwordHash: "hashed",
      role: "admin",
      deptId: 20,
      deptName: "Sales",
      position: "Manager",
      status: "retired",
    })

    expect(employee.status).toBe("retired")
  })
})

describe("Employee.withStatus", () => {
  test("returns a new Employee with the changed status", () => {
    const employee = Employee.fromRow({
      id: 1,
      code: "E001",
      name: "Taro Yamada",
      email: "taro@example.com",
      passwordHash: "hashed",
      role: "member",
      deptId: 10,
      deptName: "Engineering",
      position: "Staff",
      status: "active",
    })

    const retired = employee.withStatus("retired")

    expect(retired).toBeInstanceOf(Employee)
    expect(retired.status).toBe("retired")
    expect(retired.id).toBe(1)
    expect(retired.name).toBe("Taro Yamada")
  })
})

describe("Employee.withProfile", () => {
  test("returns a new Employee with the changed profile fields", () => {
    const employee = Employee.fromRow({
      id: 1,
      code: "E001",
      name: "Taro Yamada",
      email: "taro@example.com",
      passwordHash: "hashed",
      role: "member",
      deptId: 10,
      deptName: "Engineering",
      position: "Staff",
      status: "active",
    })

    const updated = employee.withProfile({
      name: "Taro Sato",
      email: "sato@example.com",
      role: "hr",
      deptId: 20,
      deptName: "HR",
      position: "Lead",
      status: "leave",
    })

    expect(updated).toBeInstanceOf(Employee)
    expect(updated.name).toBe("Taro Sato")
    expect(updated.email).toBe("sato@example.com")
    expect(updated.role).toBe("hr")
    expect(updated.deptId).toBe(20)
    expect(updated.deptName).toBe("HR")
    expect(updated.position).toBe("Lead")
    expect(updated.status).toBe("leave")
    expect(updated.id).toBe(1)
    expect(updated.code).toBe("E001")
  })
})
