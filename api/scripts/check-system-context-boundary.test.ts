import {
  checkSystemContextBoundary,
  inspectSystemSelfReferencePathMappings,
  inspectSystemSource,
  selectDownstreamContextNames,
} from "./check-system-context-boundary"
import { describe, expect, test } from "bun:test"

const downstreamContexts = new Set(["care", "company", "warehouse"])

describe("selectDownstreamContextNames", () => {
  test("将来追加された sibling context を固定リストなしで検査対象にする", () => {
    expect(
      selectDownstreamContextNames([
        "system",
        "core",
        "shared",
        "database",
        "company",
        "warehouse",
      ]),
    ).toEqual(new Set(["company", "warehouse"]))
  })
})

describe("inspectSystemSource", () => {
  test("両プロジェクトの System・共通部品・専用 schema への依存を許可する", () => {
    const violations = inspectSystemSource(
      "src/application/system/example.ts",
      [
        'import { Token } from "@/domain/system/auth/token"',
        'import { Account } from "@/api/domain/system/account"',
        'import { Session } from "@system/domain/auth/session"',
        'import { Id } from "@/api/domain/core/identity/id"',
        'import { parse } from "@/infrastructure/shared/parse"',
        'import { users } from "@/schema/system"',
        'import { z } from "zod"',
      ].join("\n"),
      downstreamContexts,
    )

    expect(violations).toEqual([])
  })

  test("既存および新規の下位 context と composition への依存を拒否する", () => {
    const sources = [
      'import { Worker } from "@/domain/company/workforce/worker"',
      'import { Stock } from "@/api/infrastructure/warehouse/stock"',
      'import { compose } from "@/composition/iam/compose"',
      'import { compose } from "@/api/composition/iam/compose"',
    ]

    for (const source of sources) {
      const violations = inspectSystemSource(
        "src/application/system/example.ts",
        source,
        downstreamContexts,
      )

      expect(violations.some((violation) => violation.reason.includes("依存しています"))).toBe(true)
    }
  })

  test("未定義の System self-reference を拒否する", () => {
    const violations = inspectSystemSource(
      "src/application/system/example.ts",
      'import { Employee } from "@system/company/employees"',
      downstreamContexts,
    )

    expect(violations.some((violation) => violation.reason.includes("self-reference"))).toBe(true)
  })

  test("schema barrel・他 context schema・相対 import を拒否する", () => {
    const sources = [
      'import { accounts } from "@/schema"',
      'import { employees } from "@/schema/company"',
      'import { Token } from "../../../domain/system/auth/token"',
    ]

    for (const source of sources) {
      expect(
        inspectSystemSource("src/infrastructure/system/example.ts", source, downstreamContexts),
      ).not.toEqual([])
    }
  })

  test("TypeScript の全依存構文を検査する", () => {
    const sources = [
      'import "@/domain/company/setup"',
      'export { Employee } from "@/domain/company/employees"',
      'const module = import("@/application/company/employees")',
      'import Company = require("@/infrastructure/company/accounts")',
      'type Company = import("@/domain/company/accounts").Account',
      'const schema = require("@/schema")',
    ]

    for (const source of sources) {
      const violations = inspectSystemSource(
        "src/application/system/example.ts",
        source,
        downstreamContexts,
      )

      expect(violations.some((violation) => violation.reason.includes("依存しています"))).toBe(true)
    }
  })

  test("コメント内の語彙と偽 import は無視する", () => {
    const violations = inspectSystemSource(
      "src/application/system/example.ts",
      [
        '// import { Employee } from "@/domain/company/employees"',
        "/* Company や workforce へ依存しない。 */",
        'const accountKind = "system"',
      ].join("\n"),
      downstreamContexts,
    )

    expect(violations).toEqual([])
  })

  test("識別子と実行時文字列に埋め込まれた下位 context の語彙を拒否する", () => {
    const identifierViolations = inspectSystemSource(
      "src/domain/system/example.ts",
      'const employeeId = "account-1"',
      downstreamContexts,
    )
    const stringViolations = inspectSystemSource(
      "src/domain/system/example.ts",
      'const eventType = "company.updated"',
      downstreamContexts,
    )

    expect(identifierViolations[0]?.reason).toContain('語彙 "employee"')
    expect(stringViolations[0]?.reason).toContain('語彙 "company"')
  })

  test("禁止語彙の綴りを一部に含むだけの識別子は許可する", () => {
    const violations = inspectSystemSource(
      "src/domain/system/example.ts",
      'const serialized = JSON.stringify({ value: "stringify" })',
      downstreamContexts,
    )

    expect(violations).toEqual([])
  })

  test("依存先を静的に確認できない動的 import を拒否する", () => {
    const violations = inspectSystemSource(
      "src/application/system/example.ts",
      "const load = (moduleName: string) => import(moduleName)",
      downstreamContexts,
    )

    expect(violations).toEqual([
      {
        file: "src/application/system/example.ts",
        reason: "System の動的依存先を静的に確認できません",
      },
    ])
  })
})

describe("inspectSystemSelfReferencePathMappings", () => {
  test("src と src/api の配置差を System 所有 mapping だけへ閉じ込める", () => {
    for (const sourceRoot of ["src", "src/api"]) {
      expect(
        inspectSystemSelfReferencePathMappings(
          "tsconfig.json",
          {
            "@system/application/*": [`./${sourceRoot}/application/system/*`],
            "@system/domain/*": [`./${sourceRoot}/domain/system/*`],
            "@system/infrastructure/*": [`./${sourceRoot}/infrastructure/system/*`],
          },
          sourceRoot,
        ),
      ).toEqual([])
    }
  })

  test("欠落・複数・下位 context 向けの mapping を拒否する", () => {
    const violations = inspectSystemSelfReferencePathMappings(
      "tsconfig.json",
      {
        "@system/application/*": ["./src/application/company/*"],
        "@system/domain/*": ["./src/domain/system/*", "./src/domain/company/*"],
      },
      "src",
    )

    expect(violations).toHaveLength(3)
  })
})

describe("checkSystemContextBoundary", () => {
  test("現在の System production source が独立している", async () => {
    expect(await checkSystemContextBoundary()).toEqual([])
  })
})
