import { describe, expect, test } from "bun:test"
import { PERMISSION_CATALOG } from "@/contexts/company/domain/iam/permission.catalog"
import {
  PERMISSION_KEYS,
  PERMISSION_KEYS_BY_CONTEXT,
} from "@/contexts/company/domain/iam/permission-key.catalog"

describe("permission key ownership", () => {
  test("assigns every key to exactly one context and one metadata entry", () => {
    const ownedKeys = Object.values(PERMISSION_KEYS_BY_CONTEXT).flat()
    const metadataKeys = PERMISSION_CATALOG.map((entry) => entry.key)

    expect(new Set(ownedKeys).size).toBe(ownedKeys.length)
    expect(new Set(metadataKeys).size).toBe(metadataKeys.length)
    expect([...ownedKeys].sort()).toEqual([...PERMISSION_KEYS].sort())
    expect([...metadataKeys].sort()).toEqual([...PERMISSION_KEYS].sort())
  })
})
