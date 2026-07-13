import { PERMISSION_KEYS } from "@/lib/auth/permission-keys"
import { SYSTEM_ROLE_PERMISSIONS } from "@/lib/auth/system-roles"
import { describe, expect, test } from "bun:test"

const auditPermissions = ["audit:read", "audit:export"] as const

describe("system role audit permissions", () => {
  test("includes both audit permissions in the permission catalog", () => {
    for (const permission of auditPermissions) {
      expect(PERMISSION_KEYS).toContain(permission)
    }
  })

  test("grants both audit permissions to admin only", () => {
    for (const role of SYSTEM_ROLE_PERMISSIONS) {
      for (const permission of auditPermissions) {
        expect(role.permissions.includes(permission)).toBe(role.key === "admin")
      }
    }
  })
})
