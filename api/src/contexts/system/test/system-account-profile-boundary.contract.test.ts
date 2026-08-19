import { users } from "@system/infrastructure/schema/system-runtime"
import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { getTableColumns } from "drizzle-orm"

describe("System Account profile boundary", () => {
  test("System Account schema does not expose a display name", () => {
    expect(Object.keys(getTableColumns(users))).not.toContain("name")
  })

  test("System production source does not read or define a downstream Account profile", () => {
    const contextDirectory = new URL("../", import.meta.url)
    const violations = [...new Glob("**/*.ts").scanSync({ cwd: contextDirectory.pathname })]
      .filter((path) => !path.endsWith(".test.ts") && !path.startsWith("test/"))
      .filter((path) => {
        const source = readFileSync(new URL(path, contextDirectory), "utf8")
        return /users\.name|display(?:_name|Name)|UserProfile|AccountProfile/.test(source)
      })

    expect(violations).toEqual([])
  })
})
