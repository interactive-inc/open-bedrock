import { describe, expect, test } from "bun:test"
import { PermissionValue } from "@/domain/system/iam/permission.value"

describe("PermissionValue", () => {
  test("accepts a namespaced permission and caches parsed values", () => {
    const first = PermissionValue.from("resource:read:all")
    const second = PermissionValue.from("resource:read:all")

    expect(first).toBeInstanceOf(PermissionValue)
    expect(second).toBe(first)
  })

  test("rejects malformed or unnamespaced values", () => {
    expect(PermissionValue.from("resource")).toBeNull()
    expect(PermissionValue.from("Resource:read")).toBeNull()
    expect(PermissionValue.from("resource::read")).toBeNull()
  })

  test("checks required values and gives system admin the generic bypass", () => {
    const resourceRead = PermissionValue.known("resource:read")

    expect(PermissionValue.hasAny(new Set(["resource:read"]), resourceRead)).toBe(true)
    expect(PermissionValue.hasAny(new Set(["system:admin"]), resourceRead)).toBe(true)
    expect(PermissionValue.hasAny(new Set(), resourceRead)).toBe(false)
    expect(PermissionValue.hasAny(new Set())).toBe(false)
  })
})
