import { describe, expect, test } from "bun:test"
import {
  AUTHORIZATION_KINDS,
  checkRouteAuthorization,
  collectRouteFiles,
  exportedMethods,
  inspectRouteFile,
  parseMethodDeclarations,
} from "@/../scripts/check-route-authorization"

const GATED_ROUTE = `import { verifyBearer } from "@/interface/middlewares/verify-bearer"

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session.hasPermission("employee:read") === false) throw new ForbiddenError()
  return c.json({}, 200)
})
`

/** GET は全員閲覧可、POST は権限必須。ファイル単位の宣言では表せない形。 */
const MIXED_ROUTE = `import { verifyBearer } from "@/interface/middlewares/verify-bearer"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  return c.json({}, 200)
})

// @authorization permission - 権限キーで判定する
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session.hasPermission("room:manage") === false) throw new ForbiddenError()
  return c.json({}, 201)
})
`

describe("exportedMethods", () => {
  test("HTTP メソッドの export を拾う", () => {
    expect(exportedMethods(GATED_ROUTE)).toEqual(["GET"])
  })

  test("HTTP メソッドを export しない同居ヘルパは対象外", () => {
    expect(exportedMethods("export function canReadLeaveOf() {\n  return true\n}\n")).toEqual([])
  })

  test("行頭以外の GET は拾わない", () => {
    expect(exportedMethods("  export const GETTER = 1\n")).toEqual([])
  })
})

describe("parseMethodDeclarations", () => {
  test("メソッドごとに宣言を切り出す", () => {
    const declarations = parseMethodDeclarations(MIXED_ROUTE)
    expect(declarations.map((entry) => [entry.method, entry.declared])).toEqual([
      ["GET", "authenticated"],
      ["POST", "permission"],
    ])
  })

  test("handler 本体はその export から次の export までに区切る", () => {
    const declarations = parseMethodDeclarations(MIXED_ROUTE)
    expect(declarations[0]?.body).toContain("export const GET")
    expect(declarations[0]?.body).not.toContain("export const POST")
  })

  test("宣言が無ければ null", () => {
    expect(parseMethodDeclarations("export const GET = 1\n")[0]?.declared).toBeNull()
  })
})

describe("inspectRouteFile", () => {
  test("宣言があり verifyBearer もあれば違反なし", () => {
    expect(inspectRouteFile("employees/route.ts", GATED_ROUTE)).toEqual([])
  })

  test("メソッドごとに方針が違ってもよい", () => {
    expect(inspectRouteFile("rooms/route.ts", MIXED_ROUTE)).toEqual([])
  })

  // 検査の本体。宣言を消した（＝認可を書き忘れた）ルートを必ず捕まえる。
  test("宣言が無いルートを検出する", () => {
    const undeclared = GATED_ROUTE.replace(
      "// @authorization permission - 権限キーで判定する\n",
      "",
    )
    const violations = inspectRouteFile("employees/route.ts", undeclared)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.method).toBe("GET")
    expect(violations[0]?.reason).toContain("認可の宣言がありません")
  })

  // ファイル単位の宣言だと、隣に宣言があるだけで無宣言のメソッドが通ってしまう。
  test("同じファイルで宣言の無いメソッドだけを検出する", () => {
    const partial = MIXED_ROUTE.replace("// @authorization permission - 権限キーで判定する\n", "")
    const violations = inspectRouteFile("rooms/route.ts", partial)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.method).toBe("POST")
  })

  test("未定義の宣言を検出する", () => {
    const bogus = GATED_ROUTE.replace("@authorization permission", "@authorization whatever")
    const violations = inspectRouteFile("employees/route.ts", bogus)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.reason).toContain("未定義です")
  })

  test("verifyBearer の無い permission 宣言を検出する", () => {
    const unauthenticated = GATED_ROUTE.replace(
      'import { verifyBearer } from "@/interface/middlewares/verify-bearer"\n',
      "",
    ).replace("verifyBearer, ", "")
    const violations = inspectRouteFile("employees/route.ts", unauthenticated)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.reason).toContain("verifyBearer を通っていません")
  })

  test("API compositionでglobal bearerを通すrouteはhandler内の重複guardを要求しない", () => {
    const source =
      "// @authorization service - application serviceがscopeを判定する\n" +
      "export const GET = factory.createHandlers(handler)\n"
    expect(inspectRouteFile("company/v1/employees/route.ts", source, true)).toEqual([])
  })

  // import 文に verifyBearer があるだけでは通さない（handler 本体を見る）。
  test("import だけで handler が素通しなら検出する", () => {
    const importOnly =
      'import { verifyBearer } from "@/interface/middlewares/verify-bearer"\n\n' +
      "// @authorization permission - 権限キーで判定する\n" +
      "export const GET = factory.createHandlers(async (c) => c.json({}, 200))\n"
    const violations = inspectRouteFile("employees/route.ts", importOnly)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.reason).toContain("verifyBearer を通っていません")
  })

  // 認証付きの GET が、隣の無防備な POST を隠さないこと。
  test("同じファイルで認証の無いメソッドだけを検出する", () => {
    const leaky =
      'import { verifyBearer } from "@/interface/middlewares/verify-bearer"\n\n' +
      "// @authorization authenticated - ログインしていれば誰でも読める共有データ\n" +
      "export const GET = factory.createHandlers(verifyBearer, handler)\n\n" +
      "// @authorization permission - 権限キーで判定する\n" +
      "export const POST = factory.createHandlers(handler)\n"
    const violations = inspectRouteFile("rooms/route.ts", leaky)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.method).toBe("POST")
  })

  test("owner 宣言でも認証は必要", () => {
    const source = "// @authorization owner - 本人のリソースに限定する\nexport const GET = 1\n"
    const violations = inspectRouteFile("expenses/me/route.ts", source)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.reason).toContain("verifyBearer を通っていません")
  })

  test("public は認証不要", () => {
    const source = "// @authorization public - 未認証で到達してよい\nexport const POST = 1\n"
    expect(inspectRouteFile("auth/login/route.ts", source)).toEqual([])
  })

  test("verifyBearer 付きの public 宣言を検出する", () => {
    const source =
      "// @authorization public - 未認証で到達してよい\n" +
      "export const POST = factory.createHandlers(verifyBearer, handler)\n"
    const violations = inspectRouteFile("auth/browser/code/route.ts", source)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.reason).toContain("verifyBearer を通っています")
  })

  test("machine は機械用 middleware があればよい", () => {
    const source =
      "// @authorization machine - 機械用のキーで認証する\n" +
      "export const POST = factory.createHandlers(verifyProvisioningKey, handler)\n"
    expect(inspectRouteFile("provisioning/identities/route.ts", source)).toEqual([])
  })

  // machine と書けば何も無しで通る、という抜け道を塞ぐ。
  test("machine 宣言で middleware が無ければ検出する", () => {
    const source =
      "// @authorization machine - 機械用のキーで認証する\n" +
      "export const POST = factory.createHandlers(handler)\n"
    const violations = inspectRouteFile("provisioning/identities/route.ts", source)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.reason).toContain("verify*Key middleware がありません")
  })
})

describe("checkRouteAuthorization", () => {
  test("明示登録されたcontextのrouteも検査する", async () => {
    const routeFiles = await collectRouteFiles()

    expect(
      routeFiles.some((routeFile) =>
        routeFile.file.endsWith("system/interface/routes/health/route.ts"),
      ),
    ).toBe(true)
    expect(
      routeFiles.some((routeFile) =>
        routeFile.file.endsWith("company/interface/routes/company/v1/employees.ts"),
      ),
    ).toBe(true)
  })

  test("リポジトリ全体で違反が無い", async () => {
    const { violations } = await checkRouteAuthorization()
    expect(violations).toEqual([])
  })

  test("全 handler が宣言済みで、合計が検査数と一致する", async () => {
    const { summary, checked } = await checkRouteAuthorization()
    const total = [...summary.values()].reduce((sum, count) => sum + count, 0)
    expect(total).toBe(checked)
    expect(checked).toBeGreaterThan(400)
  })

  test("宣言の種類はカタログの範囲に収まる", async () => {
    const { summary } = await checkRouteAuthorization()
    for (const kind of summary.keys()) {
      expect(AUTHORIZATION_KINDS).toContain(kind)
    }
  })
})
