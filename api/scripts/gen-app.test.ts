import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  collectRegistrations,
  exportedMethods,
  renderApp,
  renderRegistration,
  sortRegistrations,
  toAlias,
  toRouteShape,
  toUrl,
  type RouteRegistration,
} from "@/../scripts/gen-app"

const APP_PATH = resolve(import.meta.dir, "../src/app.ts")

describe("toUrl", () => {
  test("ディレクトリのパスがそのまま URL になる", () => {
    expect(toUrl("employees/route.ts")).toBe("/employees")
  })

  test("動的セグメントは :param になる", () => {
    expect(toUrl("employees/[code]/route.ts")).toBe("/employees/:code")
  })

  test("動的セグメントが複数でも対応づく", () => {
    expect(toUrl("stocktakes/[id]/assets/[code]/check/route.ts")).toBe(
      "/stocktakes/:id/assets/:code/check",
    )
  })

  test("<動詞>-route.ts は隣の route.ts と同じ URL になる", () => {
    expect(toUrl("assets/register-route.ts")).toBe("/assets")
    expect(toUrl("assets/route.ts")).toBe("/assets")
  })
})

describe("toAlias", () => {
  test("パスから別名を作る", () => {
    expect(toAlias("employees/route.ts")).toBe("employeesRoute")
  })

  test("動的セグメントの括弧は落とす", () => {
    expect(toAlias("employees/[code]/route.ts")).toBe("employeesCodeRoute")
  })

  test("ハイフンは camelCase に畳む", () => {
    expect(toAlias("application-requests/route.ts")).toBe("applicationRequestsRoute")
  })

  // 並置ファイルは隣の route.ts と別名が衝突してはいけない。
  test("<動詞>-route.ts は動詞を名前に含めて衝突を避ける", () => {
    expect(toAlias("application-requests/submit-route.ts")).toBe("applicationRequestsSubmitRoute")
    expect(toAlias("application-requests/route.ts")).toBe("applicationRequestsRoute")
    expect(toAlias("application-requests/submit-route.ts")).not.toBe(
      toAlias("application-requests/route.ts"),
    )
  })
})

describe("exportedMethods", () => {
  test("export された HTTP メソッドを拾う", () => {
    expect(exportedMethods("export const GET = 1\nexport const POST = 2\n")).toEqual([
      "GET",
      "POST",
    ])
  })

  test("HTTP メソッドを export しないヘルパは空", () => {
    expect(exportedMethods("export function toAssetResponse() {}\n")).toEqual([])
  })
})

describe("sortRegistrations", () => {
  const registration = (url: string, method: RouteRegistration["method"] = "GET") => ({
    module: `@/interface/routes${url}/route`,
    url,
    method,
    alias: "x",
  })

  // Hono は同じ形の候補を登録順で解決する。静的が後ろに回ると動的に食われる。
  test("静的パスを動的パスより先に置く", () => {
    const sorted = sortRegistrations([registration("/expenses/:id"), registration("/expenses/me")])
    expect(sorted.map((entry) => entry.url)).toEqual(["/expenses/me", "/expenses/:id"])
  })

  test("入力の順序によらず静的が先になる", () => {
    const sorted = sortRegistrations([registration("/expenses/me"), registration("/expenses/:id")])
    expect(sorted.map((entry) => entry.url)).toEqual(["/expenses/me", "/expenses/:id"])
  })

  test("セグメント数が違えば浅い方が先", () => {
    const sorted = sortRegistrations([registration("/assets/lent/me"), registration("/assets")])
    expect(sorted.map((entry) => entry.url)).toEqual(["/assets", "/assets/lent/me"])
  })
})

describe("toRouteShape", () => {
  // Hono から見れば `/a/:id` と `/a/:code` は同じ経路。名前の違いで別物にしない。
  test("パラメータ名を伏せる", () => {
    expect(toRouteShape("/employees/:code")).toBe("/employees/:")
    expect(toRouteShape("/employees/:id")).toBe(toRouteShape("/employees/:code"))
  })

  test("静的セグメントはそのまま", () => {
    expect(toRouteShape("/employees/me")).toBe("/employees/me")
    expect(toRouteShape("/employees/me")).not.toBe(toRouteShape("/employees/:id"))
  })
})

describe("renderApp の安全確認", () => {
  const registration = (
    url: string,
    alias: string,
    method: RouteRegistration["method"] = "GET",
  ) => ({
    module: `@/interface/routes${url}/route`,
    url,
    method,
    alias,
  })

  // 動的同士が先に食い違うと順序はパラメータ名の辞書順に落ちる。
  // 比較器では守れないので、生成時に検出して落とす。
  test("動的パターンが後続ルートを覆っていたら落とす", () => {
    expect(() =>
      renderApp([registration("/a/:x/:y", "one"), registration("/a/:z/fixed", "two")]),
    ).toThrow(/覆い隠されています/)
  })

  test("覆い隠しが無ければ生成できる", () => {
    expect(() =>
      renderApp([registration("/a/fixed", "one"), registration("/a/:id", "two")]),
    ).not.toThrow()
  })
})

describe("collectRegistrations", () => {
  test("interface/routes/ から全ルートを集める", async () => {
    const registrations = await collectRegistrations()
    expect(registrations.length).toBeGreaterThan(400)
  })

  test("同じ (メソッド, URL) が重複しない", async () => {
    const registrations = await collectRegistrations()
    const keys = registrations.map((entry) => `${entry.method} ${entry.url}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test("import 別名が重複しない", async () => {
    const registrations = await collectRegistrations()
    const aliasToModule = new Map<string, string>()
    for (const entry of registrations) {
      const previous = aliasToModule.get(entry.alias)
      if (previous !== undefined) expect(previous).toBe(entry.module)
      aliasToModule.set(entry.alias, entry.module)
    }
    expect(aliasToModule.size).toBeGreaterThan(300)
  })

  test("静的パスが動的パスに覆われない", async () => {
    const sorted = sortRegistrations(await collectRegistrations())
    const shadowed: string[] = []

    for (const [index, entry] of sorted.entries()) {
      if (entry.url.includes(":")) continue
      const concrete = entry.url.split("/").filter(Boolean)

      for (const earlier of sorted.slice(0, index)) {
        if (earlier.method !== entry.method) continue
        if (!earlier.url.includes(":")) continue
        const pattern = earlier.url.split("/").filter(Boolean)
        if (pattern.length !== concrete.length) continue
        const covers = pattern.every(
          (segment, position) => segment.startsWith(":") || segment === concrete[position],
        )
        if (covers) shadowed.push(`${entry.method} ${entry.url} <- ${earlier.url}`)
      }
    }

    expect(shadowed).toEqual([])
  })
})

describe("renderRegistration", () => {
  test("100 桁に収まる登録は 1 行で書く", () => {
    const line = renderRegistration({
      module: "@/interface/routes/employees/route",
      url: "/employees",
      method: "GET",
      alias: "employeesRoute",
    })
    expect(line).toBe('  .get("/employees", ...employeesRoute.GET)')
  })

  test("100 桁を超える登録は整形器と同じ形に折る", () => {
    const line = renderRegistration({
      module: "@/interface/routes/batch/employee-lifecycle/process-outbox/route",
      url: "/batch/employee-lifecycle/process-outbox",
      method: "POST",
      alias: "batchEmployeeLifecycleProcessOutboxRoute",
    })
    expect(line).toBe(
      '  .post(\n    "/batch/employee-lifecycle/process-outbox",\n    ...batchEmployeeLifecycleProcessOutboxRoute.POST,\n  )',
    )
  })

  // 生成物がそのまま整形済みでないと、gen:app の直後に vp check が落ちる。
  test("生成した登録行はどれも 100 桁に収まる（折り返した中身の文字列を除く）", async () => {
    const rendered = renderApp(await collectRegistrations())
    const tooLong = rendered
      .split("\n")
      .filter((line) => line.startsWith("  .") && line.length > 100)
    expect(tooLong).toEqual([])
  })
})

describe("renderApp", () => {
  // 生成物が現物と一致していること。ここが割れたら app.ts が手で編集されている。
  test("現在の app.ts と一致する", async () => {
    const rendered = renderApp(await collectRegistrations())
    expect(rendered).toBe(readFileSync(APP_PATH, "utf8"))
  })

  test("生成物である旨と再生成コマンドを冒頭に書く", async () => {
    const rendered = renderApp(await collectRegistrations())
    expect(rendered).toContain("bun run gen:app")
    expect(rendered).toContain("手で編集しない")
  })

  test("middleware は app-base.ts から引き継ぐ", async () => {
    const rendered = renderApp(await collectRegistrations())
    expect(rendered).toContain('import { appBase } from "@/app-base"')
    expect(rendered).toContain("export const app = appBase")
  })

  test("hc の型を export する", async () => {
    const rendered = renderApp(await collectRegistrations())
    expect(rendered).toContain("export type AppType = typeof app")
    expect(rendered).toContain("export type ApiClient = ReturnType<typeof hc<AppType>>")
  })
})
