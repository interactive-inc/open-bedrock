import {
  canContextDependOn,
  checkContextBoundaries,
  classifyContextModule,
  classifyContextSource,
  inspectContextSource,
  inspectContextTestDirectory,
  inspectLibSource,
} from "./check-context-boundaries"
import { describe, expect, test } from "bun:test"

test("context横断テストを単数形testへ配置する", () => {
  expect(
    inspectContextTestDirectory("src/contexts/system/tests/example.integration.test.ts"),
  ).not.toEqual([])
  expect(
    inspectContextTestDirectory("src/contexts/system/test/example.integration.test.ts"),
  ).toEqual([])
  expect(inspectContextTestDirectory("src/contexts/system/infrastructure/example.test.ts")).toEqual(
    [],
  )
})

describe("context path classification", () => {
  test("context-first と両製品の layer-first path を同じ所有情報へ正規化する", () => {
    expect(classifyContextSource("src/contexts/system/domain/auth/account.ts")).toEqual({
      context: "system",
      layer: "domain",
    })
    expect(classifyContextSource("src/api/application/company/accounts.ts")).toEqual({
      context: "company",
      layer: "application",
    })
    expect(classifyContextSource("src/infrastructure/care/repository.ts")).toEqual({
      context: "care",
      layer: "infrastructure",
    })
    expect(classifyContextSource("src/infrastructure/shared/parse-d1-row.ts")).toBeNull()
    expect(classifyContextSource("src/interface/routes/health/route.ts")).toBeNull()
    expect(classifyContextSource("src/api/app.ts")).toBeNull()
  })

  test("context-first・layer-first・System self-referenceを分類する", () => {
    expect(classifyContextModule("@/contexts/chat/interface/routes/messages")).toEqual({
      context: "chat",
      layer: "interface",
    })
    expect(classifyContextModule("@/api/domain/company/organization")).toEqual({
      context: "company",
      layer: "domain",
    })
    expect(classifyContextModule("@system/application/auth/login")).toEqual({
      context: "system",
      layer: "application",
    })
    expect(classifyContextModule("@/infrastructure/shared/parse-d1-row")).toBeNull()
    expect(classifyContextModule("@/interface/utils/factory")).toBeNull()
    expect(classifyContextModule("zod")).toBeNull()
  })
})

describe("context dependency matrix", () => {
  test("System > Company > 業務の一方向だけを許可する", () => {
    expect(canContextDependOn("system", "company")).toBe(false)
    expect(canContextDependOn("system", "care")).toBe(false)
    expect(canContextDependOn("company", "system")).toBe(true)
    expect(canContextDependOn("company", "chat")).toBe(false)
    expect(canContextDependOn("care", "system")).toBe(true)
    expect(canContextDependOn("care", "company")).toBe(true)
    expect(canContextDependOn("care", "chat")).toBe(false)
    expect(canContextDependOn("care", "care")).toBe(true)
  })

  test("type-onlyを含む全依存構文でcontext間の逆依存を拒否する", () => {
    const sources = [
      'import type { Employee } from "@/contexts/company/domain/employee"',
      'export { Employee } from "@/api/domain/company/employee"',
      'type Employee = import("@/domain/company/employee").Employee',
      'const company = import("@/application/company/setup")',
      'import Company = require("@/infrastructure/company/database")',
      'const company = require("@/interface/company/routes")',
    ]

    for (const source of sources) {
      expect(inspectContextSource("src/contexts/system/domain/example.ts", source)).not.toEqual([])
    }
  })

  test("許可方向・外部package・libへの依存を許可する", () => {
    const violations = inspectContextSource(
      "src/contexts/care/application/example.ts",
      [
        'import type { Account } from "@system/domain/auth/account"',
        'import type { Employee } from "@/contexts/company/domain/employee"',
        'import { parse } from "@/lib/parse"',
        'import { z } from "zod"',
      ].join("\n"),
    )

    expect(violations).toEqual([])
  })

  test("context外schema・API root・route composition・相対importを拒否する", () => {
    const sources = [
      'import { users } from "@/schema"',
      'import { factory } from "@/api/factory"',
      'import { GET } from "@/interface/routes/health/route"',
      'import { Account } from "../../../system/domain/account"',
    ]

    for (const source of sources) {
      expect(
        inspectContextSource("src/contexts/company/infrastructure/example.ts", source),
      ).not.toEqual([])
    }
  })
})

describe("lib boundary", () => {
  test("中立なpackageだけを許可し、context・schema・APIへの依存を拒否する", () => {
    expect(
      inspectLibSource(
        "src/lib/example.ts",
        ['import { z } from "zod"', 'import { value } from "./value"'].join("\n"),
      ),
    ).toEqual([])

    for (const source of [
      'import { Account } from "@system/domain/auth/account"',
      'import { Employee } from "@/contexts/company/domain/employee"',
      'import { users } from "@/schema"',
      'import { factory } from "@/api/factory"',
    ]) {
      expect(inspectLibSource("src/lib/example.ts", source)).not.toEqual([])
    }
  })
})

test("現在の context-first production source に違反がない", async () => {
  expect(await checkContextBoundaries()).toEqual([])
})
