import { describe, expect, test } from "bun:test"
import { PermissionValue } from "@/domain/system/iam/permission.value"

describe("PermissionValue", () => {
  test("accepts a namespaced permission and caches parsed values", () => {
    const first = PermissionValue.from("employee:read:all")
    const second = PermissionValue.from("employee:read:all")

    expect(first).toBeInstanceOf(PermissionValue)
    expect(second).toBe(first)
  })

  test("rejects malformed or unnamespaced values", () => {
    expect(PermissionValue.from("employee")).toBeNull()
    expect(PermissionValue.from("Employee:read")).toBeNull()
    expect(PermissionValue.from("employee::read")).toBeNull()
  })

  test("checks required values and gives system admin the generic bypass", () => {
    const employeeRead = PermissionValue.known("employee:read")

    expect(PermissionValue.hasAny(new Set(["employee:read"]), employeeRead)).toBe(true)
    expect(PermissionValue.hasAny(new Set(["system:admin"]), employeeRead)).toBe(true)
    expect(PermissionValue.hasAny(new Set(), employeeRead)).toBe(false)
    expect(PermissionValue.hasAny(new Set())).toBe(false)
  })
})
