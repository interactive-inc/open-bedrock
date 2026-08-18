import { describe, expect, test } from "bun:test"
import { Glob } from "bun"
import { readFileSync } from "node:fs"

const contextDirectory = new URL("..", import.meta.url)
const productionFiles = [...new Glob("**/*.ts").scanSync({ cwd: contextDirectory.pathname })]
  .filter((file) => !file.endsWith(".test.ts") && !file.startsWith("test/"))
  .sort()

describe("Company file responsibility contract", () => {
  test("route以外のproduction fileはtop-level操作を一つだけ持つ", () => {
    const violations = productionFiles.flatMap((file) => {
      const source = readFileSync(new URL(file, contextDirectory), "utf8")
      const operations =
        source.match(
          /^(?:export )?(?:async )?(?:function|class)|^export const (?:GET|POST|PUT|PATCH|DELETE)/gm,
        ) ?? []
      const isRoute = file.startsWith("interface/routes/")
      const allowedOperations = isRoute ? 2 : 1
      return operations.length > allowedOperations ? [`${file}: ${operations.join(", ")}`] : []
    })

    expect(violations).toEqual([])
  })

  test("同一URLのmethodを一ファイルに置きschemaと変換をrouteへ閉じる", () => {
    const manifest = readFileSync(new URL("interface/route-manifest.ts", contextDirectory), "utf8")
    const pairedRoutes = [
      "account-employee-links",
      "definitions",
      "employees",
      "employments",
      "people",
      "personnel-actions",
      "profile",
    ]
    const violations = pairedRoutes.flatMap((route) => {
      const file = `interface/routes/company/v1/${route}.ts`
      const source = readFileSync(new URL(file, contextDirectory), "utf8")
      return [
        ...(!source.includes("export const GET") || !source.includes("export const POST")
          ? [`${file}: GET and POST must be colocated`]
          : []),
        ...(source.match(/zValidator\(/g)?.length === 4
          ? []
          : [`${file}: validators must be explicit`]),
        ...(source.includes("Schema") || source.includes("schema")
          ? [`${file}: shared HTTP schema import`]
          : []),
        ...(manifest.split(`module: "@/contexts/company/interface/routes/company/v1/${route}"`)
          .length -
          1 ===
        2
          ? []
          : [`${file}: manifest does not use one module`]),
      ]
    })

    expect(violations).toEqual([])
  })

  test("薄いwrapperと汎用type再判定を再導入しない", () => {
    const forbidden = [
      "allowedTypes",
      "toCompanyResourceChange",
      "toCompanyReadQuery",
      "companyReadHeaderSchema",
      "companyReadQuerySchema",
      "companyWriteHeaderSchema",
      "createCompanyReadHandlers",
      "createCompanyWriteHandlers",
    ]
    const violations = productionFiles.flatMap((file) => {
      const source = readFileSync(new URL(file, contextDirectory), "utf8")
      return forbidden.flatMap((token) => (source.includes(token) ? [`${file}: ${token}`] : []))
    })

    expect(violations).toEqual([])
  })

  test("公開portはtypeで表しgeneric HTTP factoryを再導入しない", () => {
    const violations = productionFiles.flatMap((file) => {
      const source = readFileSync(new URL(file, contextDirectory), "utf8")
      return [
        ...(source.includes("export interface ") ? [`${file}: export interface`] : []),
        ...(source.includes("createCompanyReadHandlers") ||
        source.includes("createCompanyWriteHandlers") ||
        file.endsWith("company-resource-http.ts")
          ? [`${file}: generic Company HTTP factory`]
          : []),
      ]
    })

    expect(violations).toEqual([])
  })

  test("HTTP testはHono hc clientから呼び出す", () => {
    const files = [
      "test/company-api.integration.test.ts",
      "interface/routes/company/v1/capabilities/route.test.ts",
    ]
    const violations = files.flatMap((file) => {
      const source = readFileSync(new URL(file, contextDirectory), "utf8")
      return source.includes('from "hono/client"') && !source.includes('request("/company/')
        ? []
        : [file]
    })

    expect(violations).toEqual([])
  })
})
