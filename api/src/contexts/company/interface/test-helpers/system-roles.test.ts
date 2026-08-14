import { PERMISSION_KEYS } from "@/composition/iam/permission-key.catalog"
import { SYSTEM_ROLE_PERMISSIONS } from "@/interface/test-helpers/system-roles"
import { describe, expect, test } from "bun:test"

const auditPermissions = ["audit:read", "audit:export"] as const

const lifecyclePermissions = [
  "employee:lifecycle:request",
  "employee:lifecycle:apply",
  "employee:lifecycle:read:all",
  "employee:archive",
] as const

describe("system role audit permissions", () => {
  test("includes both audit permissions in the permission catalog", () => {
    for (const permission of auditPermissions) {
      expect(PERMISSION_KEYS).toContain(permission)
    }
  })

  test("grants both audit permissions to admin only", () => {
    for (const role of SYSTEM_ROLE_PERMISSIONS) {
      for (const permission of auditPermissions) {
        expect(role.permissions.includes(permission)).toBe(role.key === "root")
      }
    }
  })
})

describe("system role lifecycle permissions", () => {
  test("includes every lifecycle permission in the permission catalog", () => {
    for (const permission of lifecyclePermissions) {
      expect(PERMISSION_KEYS).toContain(permission)
    }
  })

  test("grants request only to manager and every lifecycle permission to hr and admin", () => {
    for (const role of SYSTEM_ROLE_PERMISSIONS) {
      for (const permission of lifecyclePermissions) {
        const expected =
          role.key === "hr" ||
          role.key === "root" ||
          (role.key === "manager" && permission === "employee:lifecycle:request")

        expect(role.permissions.includes(permission)).toBe(expected)
      }
    }
  })
})
