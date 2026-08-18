import { describe, expect, test } from "bun:test"
import { Glob } from "bun"
import { readFileSync } from "node:fs"

const contextDirectory = new URL("..", import.meta.url)
const productionFiles = [...new Glob("**/*.ts").scanSync({ cwd: contextDirectory.pathname })]
  .filter((file) => !file.endsWith(".test.ts") && !file.startsWith("test/"))
  .sort()

describe("Company file responsibility contract", () => {
  test("production fileはtop-level操作を一つだけ持つ", () => {
    const violations = productionFiles.flatMap((file) => {
      const source = readFileSync(new URL(file, contextDirectory), "utf8")
      const operations =
        source.match(
          /^(?:export )?(?:async )?(?:function|class)|^export const (?:GET|POST|PUT|PATCH|DELETE)/gm,
        ) ?? []
      return operations.length > 1 ? [`${file}: ${operations.join(", ")}`] : []
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
