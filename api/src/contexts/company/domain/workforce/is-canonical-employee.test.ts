import { isCanonicalEmployee } from "@/contexts/company/domain/workforce/is-canonical-employee"
import type { Employee } from "@/contexts/company/domain/workforce/workforce-schedule"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/workforce-id"
import { describe, expect, test } from "bun:test"

const canonicalEmployee: Employee = {
  id: restoreWorkforceId("employee", "employee-1"),
  officialName: "Example Person",
  employeeCode: "E001",
  email: "person@example.com",
  phone: "+81-90-0000-0000",
}

describe("isCanonicalEmployee", () => {
  test("accepts a canonical profile and nullable optional fields", () => {
    expect(isCanonicalEmployee(canonicalEmployee)).toBe(true)
    expect(
      isCanonicalEmployee({
        ...canonicalEmployee,
        employeeCode: null,
        email: null,
        phone: null,
      }),
    ).toBe(true)
  })

  test.each([
    { field: "officialName", value: " Example Person" },
    { field: "officialName", value: "" },
    { field: "employeeCode", value: "E001\0" },
    { field: "employeeCode", value: "" },
    { field: "email", value: " person@example.com" },
    { field: "email", value: "" },
    { field: "phone", value: "+81-90-0000-0000\0" },
    { field: "phone", value: "+81-90-0000-0000\n" },
    { field: "phone", value: "" },
  ])("rejects a non-canonical $field", (example) => {
    expect(isCanonicalEmployee({ ...canonicalEmployee, [example.field]: example.value })).toBe(
      false,
    )
  })
})
