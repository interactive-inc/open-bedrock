import {
  canContextDependOn,
  checkContextBoundaries,
  classifyContextModule,
  classifyContextSource,
  inspectApiRootPath,
  inspectBoundaryBaseline,
  inspectContextSource,
  inspectContextTestDirectory,
  inspectLegacyRuntimeRootPath,
  inspectLibSource,
} from "./check-context-boundaries"
import { LIB_BOUNDARY_BASELINE } from "./lib-boundary-baseline"
import { describe, expect, test } from "bun:test"

describe("API root structure", () => {
  test("HTTP compositionと横断testだけを許可する", () => {
    expect(inspectApiRootPath("src/api/api-route-module.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/app-base.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/app.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/read-http-exception-problem.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/route-module.registry.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/to-negotiated-http-exception-response.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/routes/inbox/counts/route.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/test/app.test.ts")).toEqual([])
  })

  test("機能実装とDDD mini-treeの流入を拒否する", () => {
    expect(inspectApiRootPath("src/api/accounts/delete-account.ts")).not.toEqual([])
    expect(inspectApiRootPath("src/api/test/domain/entity.ts")).toEqual([
      {
        file: "src/api/test/domain/entity.ts",
        reason: "API rootにDDD layer domain を作らず、所有contextへ配置してください",
      },
    ])
  })
})

test("所有者不明のcomposition・platform rootへの再配置を拒否する", () => {
  expect(inspectLegacyRuntimeRootPath("src/composition/iam/catalog.ts")).not.toEqual([])
  expect(inspectLegacyRuntimeRootPath("src/platform/database.ts")).not.toEqual([])
  expect(inspectLegacyRuntimeRootPath("src/api/app.ts")).toEqual([])
  expect(inspectLegacyRuntimeRootPath("src/lib/time/clock.ts")).toEqual([])
})

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
        inspectContextSource("src/contexts/care/infrastructure/example.ts", source),
      ).not.toEqual([])
    }
  })

  test("経過措置: #1178 の一括移動が済むまで company の @/schema 依存だけを許容する", () => {
    expect(
      inspectContextSource(
        "src/contexts/company/infrastructure/example.ts",
        'import { users } from "@/schema"',
      ),
    ).toEqual([])
    expect(
      inspectContextSource(
        "src/contexts/company/interface/test-helpers/request-with-context.ts",
        'import { app } from "@/api/app"',
      ),
    ).toEqual([])
    expect(
      inspectContextSource(
        "src/contexts/company/infrastructure/example.ts",
        'import { app } from "@/api/app"',
      ),
    ).not.toEqual([])
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

  test("新規違反と解消済みbaselineを拒否する", () => {
    const knownViolation = {
      file: "src/lib/example.ts",
      reason: "lib から所有者のある実装へ依存しています: @/contexts/company/domain/example",
    }
    const newViolation = {
      file: "src/lib/new-example.ts",
      reason: "lib から所有者のある実装へ依存しています: @/api/app",
    }

    expect(inspectBoundaryBaseline([knownViolation], [knownViolation])).toEqual([])
    expect(inspectBoundaryBaseline([knownViolation, newViolation], [knownViolation])).toEqual([
      newViolation,
    ])
    expect(inspectBoundaryBaseline([], [knownViolation])).toEqual([
      {
        file: knownViolation.file,
        reason: `解消済みのlib境界baselineを削除してください: ${knownViolation.reason}`,
      },
    ])
  })
})

test("現在のcontext・lib sourceに未管理の違反がない", async () => {
  expect(await checkContextBoundaries()).toEqual([])
})

test("既存lib違反baselineは完全一致かつ重複なしである", () => {
  expect(LIB_BOUNDARY_BASELINE.length).toBe(0)

  const keys = LIB_BOUNDARY_BASELINE.map((violation) =>
    JSON.stringify([violation.file, violation.reason]),
  )

  expect(new Set(keys).size).toBe(keys.length)
})
