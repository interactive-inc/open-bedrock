import { SYSTEM_FEATURE_PERMISSION_KEYS } from "@system/domain/catalogs/iam/system-feature-permission-key.catalog"
import { expect, test } from "bun:test"

test("System feature permission keys are exactly the non-core System vocabulary, no duplicates", () => {
  expect(SYSTEM_FEATURE_PERMISSION_KEYS).toEqual([
    "account:manage",
    "audit:read",
    "audit:export",
    "notification:send",
    "batch:view",
  ])
  expect(new Set(SYSTEM_FEATURE_PERMISSION_KEYS).size).toBe(SYSTEM_FEATURE_PERMISSION_KEYS.length)
})
