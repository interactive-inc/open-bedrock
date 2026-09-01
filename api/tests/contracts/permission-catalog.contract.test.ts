import { PERMISSION_CATALOG } from "@/api/http/permissions/permission.catalog"
import { PERMISSION_KEYS } from "@/api/http/permissions/permission-key.catalog"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { describe, expect, test } from "bun:test"

function toDuplicates(values: ReadonlyArray<string>): ReadonlyArray<string> {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }

  return [...duplicates].sort()
}

function toMissing(left: ReadonlyArray<string>, right: ReadonlySet<string>): ReadonlyArray<string> {
  return [...new Set(left)].filter((value) => !right.has(value)).sort()
}

describe("permission catalog contract", () => {
  test("PERMISSION_KEYSに重複がない", () => {
    expect(toDuplicates(PERMISSION_KEYS)).toEqual([])
  })

  test("PERMISSION_KEYSとPERMISSION_CATALOGのkey集合が一致する", () => {
    const keySet = new Set<string>(PERMISSION_KEYS)
    const catalogKeys = PERMISSION_CATALOG.map((entry) => entry.key)
    const catalogKeySet = new Set<string>(catalogKeys)

    const inKeysOnly = toMissing(PERMISSION_KEYS, catalogKeySet)
    const inCatalogOnly = toMissing(catalogKeys, keySet)

    expect({ inKeysOnly, inCatalogOnly }).toEqual({ inKeysOnly: [], inCatalogOnly: [] })
  })

  test("system_iam_role_permissionsのseed行がすべてPERMISSION_KEYSに含まれる", async () => {
    const keySet = new Set<string>(PERMISSION_KEYS)
    const db = createD1TestDatabase(loadSchema())

    const result = await db
      .prepare("SELECT DISTINCT permission_key FROM system_iam_role_permissions")
      .all<{ permission_key: string }>()

    const unknownKeys = result.results
      .map((row) => row.permission_key)
      .filter((key) => !keySet.has(key))
      .sort()

    expect(unknownKeys).toEqual([])
  })
})
