import { checkSystemContextBoundary, inspectSystemSource } from "./check-system-context-boundary"
import { describe, expect, test } from "bun:test"

describe("inspectSystemSource", () => {
  test("accepts System and shared dependencies", () => {
    const violations = inspectSystemSource(
      "src/application/system/example.ts",
      'import { Token } from "@/domain/system/auth/token"\nimport { parse } from "@/infrastructure/shared/parse"',
    )

    expect(violations).toEqual([])
  })

  test("rejects an upward context dependency", () => {
    const violations = inspectSystemSource(
      "src/application/system/example.ts",
      'import { Worker } from "@/domain/company/workforce/worker"',
    )

    expect(violations.length).toBe(2)
  })
})

describe("checkSystemContextBoundary", () => {
  test("keeps current System production sources independent", async () => {
    expect(await checkSystemContextBoundary()).toEqual([])
  })
})
