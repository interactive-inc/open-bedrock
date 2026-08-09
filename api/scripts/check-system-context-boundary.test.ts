import { checkSystemContextBoundary, inspectSystemSource } from "./check-system-context-boundary"
import { describe, expect, test } from "bun:test"

describe("inspectSystemSource", () => {
  test("accepts System and shared dependencies", () => {
    const violations = inspectSystemSource(
      "src/application/system/example.ts",
      [
        'import { Token } from "@/domain/system/auth/token"',
        'import { parse } from "@/infrastructure/shared/parse"',
        'import { z } from "zod"',
      ].join("\n"),
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

  test("rejects the mixed schema and relative import escape hatches", () => {
    const mixedSchema = inspectSystemSource(
      "src/infrastructure/system/example.ts",
      'import { accounts } from "@/schema"',
    )
    const relativeImport = inspectSystemSource(
      "src/infrastructure/system/example.ts",
      'import { Token } from "../../../domain/system/auth/token"',
    )

    expect(mixedSchema.length).toBe(1)
    expect(relativeImport.length).toBe(1)
  })

  test("rejects every TypeScript module dependency syntax", () => {
    const sources = [
      'import "@/domain/company/setup"',
      'export { Employee } from "@/domain/company/employees"',
      'const module = import("@/application/company/employees")',
      'import Company = require("@/infrastructure/company/accounts")',
      'type Company = import("@/domain/company/accounts").Account',
      'const schema = require("@/schema")',
    ]

    for (const source of sources) {
      const violations = inspectSystemSource("src/application/system/example.ts", source)

      expect(violations.some((violation) => violation.reason.includes("上位コンテキスト"))).toBe(
        true,
      )
    }
  })

  test("ignores forbidden vocabulary and fake imports inside comments", () => {
    const violations = inspectSystemSource(
      "src/application/system/example.ts",
      [
        '// import { Employee } from "@/domain/company/employees"',
        "/* Company や workforce へ依存しない。 */",
        'const accountKind = "system"',
      ].join("\n"),
    )

    expect(violations).toEqual([])
  })

  test("rejects forbidden vocabulary in identifiers and runtime strings", () => {
    const identifierViolations = inspectSystemSource(
      "src/domain/system/example.ts",
      'const employeeId = "account-1"',
    )
    const stringViolations = inspectSystemSource(
      "src/domain/system/example.ts",
      'const eventType = "company.updated"',
    )

    expect(identifierViolations[0]?.reason).toContain('語彙 "employee"')
    expect(stringViolations[0]?.reason).toContain('語彙 "company"')
  })

  test("accepts longer identifiers that only contain a forbidden spelling", () => {
    const violations = inspectSystemSource(
      "src/domain/system/example.ts",
      'const serialized = JSON.stringify({ value: "stringify" })',
    )

    expect(violations).toEqual([])
  })

  test("rejects a dynamic dependency whose destination cannot be inspected", () => {
    const violations = inspectSystemSource(
      "src/application/system/example.ts",
      "const load = (moduleName: string) => import(moduleName)",
    )

    expect(violations).toEqual([
      {
        file: "src/application/system/example.ts",
        reason: "System の動的依存先を静的に確認できません",
      },
    ])
  })
})

describe("checkSystemContextBoundary", () => {
  test("keeps current System production sources independent", async () => {
    expect(await checkSystemContextBoundary()).toEqual([])
  })
})
