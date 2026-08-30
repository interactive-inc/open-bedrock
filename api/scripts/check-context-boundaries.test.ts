import {
  canContextDependOn,
  checkContextBoundaries,
  classifyContextModule,
  classifyContextSource,
  inspectApiRootPath,
  inspectCompanyAreaManifest,
  inspectCompanyRootPath,
  inspectCompanyAreaPath,
  inspectContextSource,
  inspectContextTestDirectory,
  inspectContextLibraryContract,
  inspectContextRootLibrarySource,
  inspectDisallowedRuntimeRootPath,
  inspectLibSource,
  inspectRetiredContextPath,
  inspectRetiredLayerFirstRootPath,
  inspectRouteOwnershipPath,
  inspectSourceOrganization,
} from "./check-context-boundaries"
import { describe, expect, test } from "bun:test"

describe("API root structure", () => {
  test("HTTP compositionだけを許可し、横断testはtestsへ分離する", () => {
    expect(inspectApiRootPath("src/api/api-route-module.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/app-base.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/app.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/database-middleware.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/route-module.registry.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/http/dashboard/get-dashboard.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/error-response/handle-api-error.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/routes/inbox/counts/route.ts")).toEqual([])
    expect(inspectApiRootPath("src/api/test/app.test.ts")).not.toEqual([])
    expect(inspectApiRootPath("src/api/system/auth/repository.ts")).not.toEqual([])
  })

  test("機能実装とDDD mini-treeの流入を拒否する", () => {
    expect(inspectApiRootPath("src/api/accounts/delete-account.ts")).not.toEqual([])
    expect(inspectApiRootPath("src/api/http/domain/entity.ts")).toEqual([
      {
        file: "src/api/http/domain/entity.ts",
        reason: "API rootにDDD layer domain を作らず、所有contextへ配置してください",
      },
    ])
  })
})

test("所有者不明のcomposition・platform rootへの再配置を拒否する", () => {
  expect(inspectDisallowedRuntimeRootPath("src/composition/iam/catalog.ts")).not.toEqual([])
  expect(inspectDisallowedRuntimeRootPath("src/platform/database.ts")).not.toEqual([])
  expect(inspectDisallowedRuntimeRootPath("src/api/app.ts")).toEqual([])
  expect(inspectDisallowedRuntimeRootPath("src/lib/time/clock.ts")).toEqual([])
})

describe("source organization", () => {
  test("Error定義を所有単位のerrors.tsへまとめる", () => {
    expect(
      inspectSourceOrganization(
        "src/lib/identity/errors.ts",
        "export class InvalidIdValueError extends Error {}",
      ),
    ).toEqual([])
    expect(
      inspectSourceOrganization(
        "src/lib/identity/invalid-id-value.error.ts",
        "export class InvalidIdValueError extends Error {}",
      ),
    ).not.toEqual([])
  })

  test("re-exportをproductionとtestの両方で拒否する", () => {
    expect(
      inspectSourceOrganization("src/lib/index.ts", 'export { value } from "./value"'),
    ).not.toEqual([])
    expect(
      inspectSourceOrganization("src/lib/index.test.ts", 'export * from "./fixture"'),
    ).not.toEqual([])
  })
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

test("Systemへ統合したrequest contextの再導入を拒否する", () => {
  expect(inspectRetiredContextPath("src/contexts/request/domain/request.ts")).not.toEqual([])
  expect(
    inspectRetiredContextPath("src/contexts/company-compatibility/domain/example.ts"),
  ).not.toEqual([])
  expect(
    inspectRetiredContextPath("src/contexts/system-compatibility/application/example.ts"),
  ).not.toEqual([])
  expect(inspectRetiredContextPath("src/contexts/system/domain/workflow/proposal.ts")).toEqual([])
  expect(inspectRetiredContextPath("src/contexts/company/application/procedure.ts")).toEqual([])
})

describe("context path classification", () => {
  test("context-first path だけを所有情報へ分類する", () => {
    expect(classifyContextSource("src/contexts/system/domain/auth/account.ts")).toEqual({
      context: "system",
      layer: "domain",
    })
    expect(classifyContextSource("src/api/application/company/accounts.ts")).toBeNull()
    expect(classifyContextSource("src/api/system/auth/account.ts")).toBeNull()
    expect(classifyContextSource("src/infrastructure/care/repository.ts")).toBeNull()
    expect(classifyContextSource("src/infrastructure/shared/parse-d1-row.ts")).toBeNull()
    expect(classifyContextSource("src/interface/routes/health/route.ts")).toBeNull()
    expect(classifyContextSource("src/api/app.ts")).toBeNull()
  })

  test("context-first・System self-referenceだけを分類する", () => {
    expect(classifyContextModule("@/contexts/chat/interface/routes/messages")).toEqual({
      context: "chat",
      layer: "interface",
    })
    expect(classifyContextModule("@/api/domain/company/organization")).toBeNull()
    expect(classifyContextModule("@system/application/auth/login")).toEqual({
      context: "system",
      layer: "application",
    })
    expect(classifyContextModule("@/api/system/auth/repository")).toBeNull()
    expect(classifyContextModule("@/infrastructure/shared/parse-d1-row")).toBeNull()
    expect(classifyContextModule("@/interface/utils/factory")).toBeNull()
    expect(classifyContextModule("zod")).toBeNull()
  })

  test("撤去済みの layer-first root を拒否する", () => {
    expect(inspectRetiredLayerFirstRootPath("src/domain/company")).not.toEqual([])
    expect(inspectRetiredLayerFirstRootPath("src/api/infrastructure/care")).not.toEqual([])
    expect(inspectRetiredLayerFirstRootPath("src/contexts/care/domain")).toEqual([])
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
        'import { Account } from "@system/domain/auth/account.entity"',
        'import type { Employee } from "@/contexts/company/domain/employee"',
        'import { parse } from "@/lib/parse"',
        'import { z } from "zod"',
      ].join("\n"),
    )

    expect(violations).toEqual([])
  })

  test("contextのHTTP adapterだけが共通API runtimeを利用できる", () => {
    expect(
      inspectContextSource(
        "src/contexts/care/interface/routes/example.ts",
        [
          'import { factory } from "@/api/http/factory"',
          'import { verifyBearer } from "@/api/http/verify-bearer"',
          'import { gate } from "@/api/http/middlewares/feature-gate"',
        ].join("\n"),
      ),
    ).toEqual([])
    expect(
      inspectContextSource(
        "src/contexts/care/application/example.ts",
        'import { factory } from "@/api/http/factory"',
      ),
    ).not.toEqual([])
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

  test("Companyから全体schema・API rootへの移行時例外を残さない", () => {
    expect(
      inspectContextSource(
        "src/contexts/company/infrastructure/example.ts",
        'import { users } from "@/schema"',
      ),
    ).not.toEqual([])
    expect(
      inspectContextSource(
        "src/contexts/company/interface/utils/request-with-context.ts",
        'import { app } from "@/api/app"',
      ),
    ).not.toEqual([])
  })
})

describe("ownership manifest", () => {
  test("Company直下をDDDの4層と横断testに限定し、互換directoryを残さない", () => {
    expect(
      inspectCompanyRootPath("src/contexts/company/domain/entities/company-resource.entity.ts"),
    ).toEqual([])
    expect(
      inspectCompanyRootPath("src/contexts/company/test/company-api.integration.test.ts"),
    ).toEqual([])
    expect(
      inspectCompanyRootPath("src/contexts/company/compatibility/account-backfill.ts"),
    ).not.toEqual([])
  })

  test("Companyの各層をmanifestで宣言した領域へ限定する", () => {
    expect(
      inspectCompanyAreaPath("src/contexts/company/domain/entities/company-resource.entity.ts"),
    ).toEqual([])
    expect(
      inspectCompanyAreaPath(
        "src/contexts/company/application/organization/write-organization-change.ts",
      ),
    ).toEqual([])
    expect(
      inspectCompanyAreaPath(
        "src/contexts/company/infrastructure/adapters/organization/read-organization.adapter.ts",
      ),
    ).toEqual([])
    expect(
      inspectCompanyAreaPath(
        "src/contexts/company/infrastructure/organization/read-organization.repository.ts",
      ),
    ).not.toEqual([])
    expect(
      inspectCompanyAreaPath("src/contexts/company/domain/expense/expense.entity.ts"),
    ).not.toEqual([])
  })

  test("Companyの領域manifestを実ディレクトリと完全一致させる", () => {
    const domainAreas = ["catalogs", "definitions", "entities", "policies", "values"]

    expect(inspectCompanyAreaManifest("domain", domainAreas)).toEqual([])
    expect(inspectCompanyAreaManifest("domain", domainAreas.slice(1))).not.toEqual([])
    expect(inspectCompanyAreaManifest("domain", [...domainAreas, "expense"])).not.toEqual([])
  })

  test("業務routeを宣言済みcontextへ固定する", () => {
    expect(
      inspectRouteOwnershipPath(
        "src/contexts/expense/interface/routes/department-budgets/route.ts",
      ),
    ).toEqual([])
    expect(
      inspectRouteOwnershipPath(
        "src/contexts/company/interface/routes/department-budgets/route.ts",
      ),
    ).not.toEqual([])
    expect(
      inspectRouteOwnershipPath(
        "src/contexts/expense/interface/routes/department-budgets.summary.test.ts",
      ),
    ).toEqual([])
    expect(
      inspectRouteOwnershipPath(
        "src/contexts/company/interface/routes/department-budgets.summary.ts",
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

  test("context直下のlibraryへ責務文書と直接テストを要求する", () => {
    expect(inspectContextLibraryContract("src/contexts/system/lib/auth", true, true)).toEqual([])
    expect(inspectContextLibraryContract("src/contexts/system/lib/auth", false, true)).toHaveLength(
      1,
    )
    expect(inspectContextLibraryContract("src/contexts/system/lib/auth", true, false)).toHaveLength(
      1,
    )
  })

  test("context直下のlibraryをHTTP・DB・runtime実装から独立させる", () => {
    expect(
      inspectContextRootLibrarySource(
        "src/contexts/company/lib/workforce/resolve.ts",
        'import type { Employee } from "@/contexts/company/domain/employee"',
      ),
    ).toEqual([])
    expect(
      inspectContextRootLibrarySource(
        "src/contexts/company/lib/workforce/resolve.ts",
        'import { employees } from "@/contexts/company/infrastructure/schema/company"',
      ),
    ).not.toEqual([])
  })
})

test("現在のcontext・lib sourceに未管理の違反がない", async () => {
  expect(await checkContextBoundaries()).toEqual([])
})
