import {
  checkSystemContextBoundary,
  collectSystemSchemaTableNames,
  inspectSystemCapabilityCatalog,
  inspectSystemCapabilityRootEntries,
  inspectSystemOwnershipManifest,
  inspectSystemSelfReferencePathMappings,
  inspectSystemSource,
  selectDownstreamContextNames,
} from "./check-system-context-boundary"
import { describe, expect, test } from "bun:test"

const downstreamContexts = new Set(["care", "company", "warehouse"])

describe("System ownership manifest", () => {
  const manifest = {
    version: 2,
    implementedCapabilities: ["audit", "auth"],
    forbiddenProductMarkers: ["productx", "vendorx"],
    schemaTables: ["accounts", "auditLogs"],
    targetCapabilities: ["audit", "auth", "events"],
  }

  test("宣言と実装が完全一致すれば拡張可能な System として受理する", () => {
    expect(
      inspectSystemOwnershipManifest(
        "system-context.manifest.json",
        manifest,
        ["auth", "audit"],
        ["auditLogs", "accounts"],
        ["events", "auth", "audit"],
      ),
    ).toEqual([])
  })

  test("未宣言実装と実装のない宣言を capability / schema table の両方で拒否する", () => {
    const violations = inspectSystemOwnershipManifest(
      "system-context.manifest.json",
      manifest,
      ["auth", "features"],
      ["accounts", "settings"],
      ["audit", "auth", "events"],
    )

    expect(violations.map((violation) => violation.reason)).toEqual([
      "未宣言の System capability です: features",
      "実装がない System capability 宣言です: audit",
      "未宣言の System schema table です: settings",
      "実装がない System schema table 宣言です: auditLogs",
    ])
  })

  test("未知 field・version・配列形式・名前・重複・未整列を fail closed で拒否する", () => {
    const invalidManifests: unknown[] = [
      null,
      { ...manifest, extra: true },
      { ...manifest, version: 1 },
      { ...manifest, implementedCapabilities: "auth" },
      { ...manifest, implementedCapabilities: ["Auth"] },
      { ...manifest, implementedCapabilities: ["auth", "auth"] },
      { ...manifest, implementedCapabilities: ["auth", "audit"] },
      { ...manifest, forbiddenProductMarkers: "productx" },
      { ...manifest, forbiddenProductMarkers: ["ProductX"] },
      { ...manifest, forbiddenProductMarkers: ["product-x"] },
      { ...manifest, forbiddenProductMarkers: ["productx", "productx"] },
      { ...manifest, forbiddenProductMarkers: ["vendorx", "productx"] },
      { ...manifest, schemaTables: ["accounts", 1] },
      { ...manifest, schemaTables: ["Accounts"] },
      { ...manifest, schemaTables: ["accounts", "accounts"] },
      { ...manifest, schemaTables: ["auditLogs", "accounts"] },
      { ...manifest, targetCapabilities: "auth" },
      { ...manifest, targetCapabilities: ["Auth"] },
      { ...manifest, targetCapabilities: ["audit", "audit"] },
      { ...manifest, targetCapabilities: ["auth", "audit"] },
    ]

    for (const invalidManifest of invalidManifests) {
      expect(
        inspectSystemOwnershipManifest(
          "system-context.manifest.json",
          invalidManifest,
          ["audit", "auth"],
          ["accounts", "auditLogs"],
          ["audit", "auth", "events"],
        ),
      ).not.toEqual([])
    }
  })

  test("共通capability catalogとtarget manifestの乖離を拒否する", () => {
    const missingTarget = inspectSystemOwnershipManifest(
      "system-context.manifest.json",
      { ...manifest, targetCapabilities: ["audit", "auth"] },
      ["audit", "auth"],
      ["accounts", "auditLogs"],
      ["audit", "auth", "events"],
    )
    const unknownTarget = inspectSystemOwnershipManifest(
      "system-context.manifest.json",
      { ...manifest, targetCapabilities: ["audit", "auth", "events", "unknown"] },
      ["audit", "auth"],
      ["accounts", "auditLogs"],
      ["audit", "auth", "events"],
    )

    expect(missingTarget.map((violation) => violation.reason)).toContain(
      "targetCapabilities に共通 capability がありません: events",
    )
    expect(unknownTarget.map((violation) => violation.reason)).toContain(
      "targetCapabilities にcatalog外の capability があります: unknown",
    )
  })

  test("System root の直下 production file による manifest 迂回を拒否する", () => {
    expect(
      inspectSystemCapabilityRootEntries("src/domain/system", [
        { name: "auth", isDirectory: true },
        { name: "feature.ts", isDirectory: false },
        { name: "feature.test.ts", isDirectory: false },
        { name: "README.md", isDirectory: false },
      ]),
    ).toEqual([
      {
        file: "src/domain/system/feature.ts",
        reason: "System production source は宣言済み capability namespace 配下へ置いてください",
      },
    ])
  })

  test("exported sqliteTable だけを schema ownership として抽出する", () => {
    const source = [
      'import { sqliteTable as defineTable } from "drizzle-orm/sqlite-core"',
      'import * as sqlite from "drizzle-orm/sqlite-core"',
      'export const accounts = defineTable("accounts", {})',
      'const hidden = defineTable("hidden", {})',
      "export const relation = relations(accounts, () => ({}))",
      'export const auditLogs = sqlite.sqliteTable("audit_logs", {})',
    ].join("\n")

    expect(collectSystemSchemaTableNames("src/schema/system.ts", source)).toEqual([
      "accounts",
      "auditLogs",
    ])
  })
})

describe("System capability catalog", () => {
  test("export constの昇順・一意な文字列arrayから共通targetを読む", () => {
    const inspected = inspectSystemCapabilityCatalog(
      "system-capability.catalog.ts",
      [
        'export const SYSTEM_CAPABILITY_NAMES = ["audit", "auth", "events"] as const',
        "Object.freeze(SYSTEM_CAPABILITY_NAMES)",
      ].join("\n"),
    )

    expect(inspected).toEqual({ capabilities: ["audit", "auth", "events"], violations: [] })
  })

  test("欠落・複数宣言・非literal・不正名・重複・未整列を拒否する", () => {
    const invalidSources = [
      "export const OTHER = [] as const",
      'export const SYSTEM_CAPABILITY_NAMES = ["audit"] as const\nexport const SYSTEM_CAPABILITY_NAMES = ["auth"] as const',
      'export let SYSTEM_CAPABILITY_NAMES = ["audit"] as const',
      'export const SYSTEM_CAPABILITY_NAMES = ["audit"]',
      "export const SYSTEM_CAPABILITY_NAMES = capabilities",
      'export const SYSTEM_CAPABILITY_NAMES = ["Audit"] as const',
      'export const SYSTEM_CAPABILITY_NAMES = ["audit", "audit"] as const',
      'export const SYSTEM_CAPABILITY_NAMES = ["auth", "audit"] as const',
    ]

    for (const source of invalidSources) {
      expect(
        inspectSystemCapabilityCatalog("system-capability.catalog.ts", source).violations,
      ).not.toEqual([])
    }
  })
})

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
        'import { systemAccounts } from "@/schema/system-core"',
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
      'import { Worker } from "@/contexts/company/domain/workforce/worker"',
      'import { Stock } from "@/contexts/warehouse/infrastructure/stock"',
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

  test("宣言された製品markerを識別子と実行時文字列から拒否する", () => {
    const forbiddenProductMarkers = new Set(["productx"])
    const identifierViolations = inspectSystemSource(
      "src/domain/system/example.ts",
      "const productxClient = true",
      downstreamContexts,
      forbiddenProductMarkers,
    )
    const stringViolations = inspectSystemSource(
      "src/application/system/example.ts",
      'const issuer = "https://auth.productx.example"',
      downstreamContexts,
      forbiddenProductMarkers,
    )
    const templateViolations = inspectSystemSource(
      "src/application/system/example.ts",
      "const issuer = `https://${tenant}.productx.example`",
      downstreamContexts,
      forbiddenProductMarkers,
    )
    const regularExpressionViolations = inspectSystemSource(
      "src/domain/system/example.ts",
      "const allowedHost = /productx\\.example/",
      downstreamContexts,
      forbiddenProductMarkers,
    )

    expect(identifierViolations[0]?.reason).toContain('製品 marker "productx"')
    expect(stringViolations[0]?.reason).toContain('製品 marker "productx"')
    expect(templateViolations[0]?.reason).toContain('製品 marker "productx"')
    expect(regularExpressionViolations[0]?.reason).toContain('製品 marker "productx"')
  })

  test("製品markerのコメント・部分綴り・未宣言markerを拒否しない", () => {
    const violations = inspectSystemSource(
      "src/domain/system/example.ts",
      [
        "// productx configuration belongs to composition",
        "const unproductxable = true",
        'const vendor = "vendory"',
      ].join("\n"),
      downstreamContexts,
      new Set(["productx"]),
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
